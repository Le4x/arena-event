import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException, ConflictException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { AuthService } from '../../src/auth/auth.service';
import { UsersService } from '../../src/users/users.service';
import { Role } from '@prisma/client';

// Mock bcrypt
jest.mock('bcrypt', () => ({
  compare: jest.fn(),
  hash: jest.fn(),
}));

describe('AuthService', () => {
  let service: AuthService;
  let usersService: UsersService;
  let jwtService: JwtService;

  const mockUsersService = {
    findByEmail: jest.fn(),
    findById: jest.fn(),
    create: jest.fn(),
  };

  const mockJwtService = {
    sign: jest.fn(),
    verify: jest.fn(),
  };

  const mockUser = {
    id: 'user-123',
    email: 'test@example.com',
    password: 'hashedPassword123',
    role: Role.ORGANIZER,
    firstName: 'John',
    lastName: 'Doe',
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: UsersService,
          useValue: mockUsersService,
        },
        {
          provide: JwtService,
          useValue: mockJwtService,
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    usersService = module.get<UsersService>(UsersService);
    jwtService = module.get<JwtService>(JwtService);

    jest.clearAllMocks();
  });

  describe('validateUser', () => {
    it('should throw UnauthorizedException when user not found', async () => {
      mockUsersService.findByEmail.mockResolvedValue(null);

      await expect(service.validateUser('invalid@email.com', 'password')).rejects.toThrow(
        UnauthorizedException,
      );
      expect(mockUsersService.findByEmail).toHaveBeenCalledWith('invalid@email.com');
    });

    it('should throw UnauthorizedException when password is invalid', async () => {
      mockUsersService.findByEmail.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(service.validateUser('test@example.com', 'wrongpassword')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should return user without password when credentials are valid', async () => {
      mockUsersService.findByEmail.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      const result = await service.validateUser('test@example.com', 'correctpassword');

      expect(result).toEqual({
        id: mockUser.id,
        email: mockUser.email,
        role: mockUser.role,
        firstName: mockUser.firstName,
        lastName: mockUser.lastName,
      });
      expect(result.password).toBeUndefined();
    });
  });

  describe('login', () => {
    it('should return access token and user info', async () => {
      const userWithoutPassword = {
        id: mockUser.id,
        email: mockUser.email,
        role: mockUser.role,
        firstName: mockUser.firstName,
        lastName: mockUser.lastName,
      };
      mockJwtService.sign.mockReturnValue('jwt-token-123');

      const result = await service.login(userWithoutPassword);

      expect(mockJwtService.sign).toHaveBeenCalledWith({
        sub: mockUser.id,
        email: mockUser.email,
        role: mockUser.role,
      });
      expect(result).toEqual({
        accessToken: 'jwt-token-123',
        user: {
          id: mockUser.id,
          email: mockUser.email,
          role: mockUser.role,
          firstName: mockUser.firstName,
          lastName: mockUser.lastName,
        },
      });
    });
  });

  describe('register', () => {
    it('should throw ConflictException when email already exists', async () => {
      mockUsersService.findByEmail.mockResolvedValue(mockUser);

      await expect(
        service.register('test@example.com', 'password123', 'John', 'Doe'),
      ).rejects.toThrow(ConflictException);
    });

    it('should create user and return tokens when email is new', async () => {
      const newUser = { ...mockUser, id: 'new-user-456' };
      mockUsersService.findByEmail.mockResolvedValue(null);
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashedNewPassword');
      mockUsersService.create.mockResolvedValue(newUser);
      mockJwtService.sign.mockReturnValue('new-jwt-token');

      const result = await service.register('new@example.com', 'password123', 'Jane', 'Smith');

      expect(bcrypt.hash).toHaveBeenCalledWith('password123', 10);
      expect(mockUsersService.create).toHaveBeenCalledWith({
        email: 'new@example.com',
        password: 'hashedNewPassword',
        firstName: 'Jane',
        lastName: 'Smith',
        role: Role.ORGANIZER,
      });
      expect(result.accessToken).toBe('new-jwt-token');
    });

    it('should use ORGANIZER as default role', async () => {
      mockUsersService.findByEmail.mockResolvedValue(null);
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed');
      mockUsersService.create.mockResolvedValue(mockUser);
      mockJwtService.sign.mockReturnValue('token');

      await service.register('test@example.com', 'password');

      expect(mockUsersService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          role: Role.ORGANIZER,
        }),
      );
    });

    it('should allow specifying a different role', async () => {
      mockUsersService.findByEmail.mockResolvedValue(null);
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed');
      mockUsersService.create.mockResolvedValue({ ...mockUser, role: Role.GAME_MASTER });
      mockJwtService.sign.mockReturnValue('token');

      await service.register('test@example.com', 'password', 'John', 'Doe', Role.GAME_MASTER);

      expect(mockUsersService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          role: Role.GAME_MASTER,
        }),
      );
    });
  });

  describe('verifyToken', () => {
    it('should return payload when token is valid', async () => {
      const payload = { sub: 'user-123', email: 'test@example.com', role: Role.ORGANIZER };
      mockJwtService.verify.mockReturnValue(payload);

      const result = await service.verifyToken('valid-token');

      expect(result).toEqual(payload);
    });

    it('should throw UnauthorizedException when token is invalid', async () => {
      mockJwtService.verify.mockImplementation(() => {
        throw new Error('Invalid token');
      });

      await expect(service.verifyToken('invalid-token')).rejects.toThrow(UnauthorizedException);
    });
  });
});
