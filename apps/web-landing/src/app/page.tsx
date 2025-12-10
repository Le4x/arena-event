'use client'

import { useState } from 'react'

export default function LandingPage() {
  const [showVideoModal, setShowVideoModal] = useState(false)

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-indigo-900 to-blue-900">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-black/20 backdrop-blur-md border-b border-white/10">
        <nav className="container mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-blue-500 rounded-lg flex items-center justify-center">
              <span className="text-2xl">🎮</span>
            </div>
            <span className="text-white text-2xl font-bold">Arena Event</span>
          </div>

          <div className="hidden md:flex items-center space-x-8">
            <a href="#features" className="text-white/80 hover:text-white transition">Fonctionnalités</a>
            <a href="#how-it-works" className="text-white/80 hover:text-white transition">Comment ça marche</a>
            <a href="#pricing" className="text-white/80 hover:text-white transition">Tarifs</a>
          </div>

          <a
            href="https://admin.arena-event.fr"
            className="px-6 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg border border-white/20 transition"
          >
            Connexion
          </a>
        </nav>
      </header>

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-6">
        <div className="container mx-auto max-w-6xl">
          <div className="text-center mb-12">
            <h1 className="text-5xl md:text-7xl font-bold text-white mb-6 leading-tight">
              Animez vos événements avec des{' '}
              <span className="bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent">
                Quiz en Direct
              </span>
            </h1>
            <p className="text-xl md:text-2xl text-white/80 mb-8 max-w-3xl mx-auto">
              La plateforme professionnelle pour créer et animer des quiz, blind tests et jeux interactifs en temps réel
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-12">
              <a
                href="https://admin.arena-event.fr"
                className="px-8 py-4 bg-gradient-to-r from-purple-500 to-blue-500 text-white rounded-xl font-semibold text-lg hover:shadow-2xl hover:shadow-purple-500/50 transition-all transform hover:scale-105"
              >
                Commencer Gratuitement
              </a>
              <button
                onClick={() => setShowVideoModal(true)}
                className="px-8 py-4 bg-white/10 backdrop-blur-sm text-white rounded-xl font-semibold text-lg border border-white/20 hover:bg-white/20 transition flex items-center gap-2"
              >
                <span>▶</span>
                Voir la Démo
              </button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-8 max-w-2xl mx-auto">
              <div className="text-center">
                <div className="text-4xl font-bold text-white mb-2">80+</div>
                <div className="text-white/60">Joueurs actifs</div>
              </div>
              <div className="text-center">
                <div className="text-4xl font-bold text-white mb-2">5+</div>
                <div className="text-white/60">Types de jeux</div>
              </div>
              <div className="text-center">
                <div className="text-4xl font-bold text-white mb-2">100%</div>
                <div className="text-white/60">Temps réel</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 px-6">
        <div className="container mx-auto max-w-6xl">
          <h2 className="text-4xl md:text-5xl font-bold text-white text-center mb-16">
            Tout ce dont vous avez besoin
          </h2>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {[
              {
                icon: '🎯',
                title: 'Multi-Sessions',
                description: 'Hébergez plusieurs quiz simultanément sur la même infrastructure'
              },
              {
                icon: '⚡',
                title: 'Temps Réel',
                description: 'Synchronisation instantanée via WebSocket sur tous les appareils'
              },
              {
                icon: '📱',
                title: 'Multi-Devices',
                description: 'Interfaces optimisées pour admin, animateur, joueurs et écran public'
              },
              {
                icon: '🔐',
                title: 'Sécurisé',
                description: 'Authentification JWT avec gestion des rôles (SuperAdmin, Organizer, GameMaster)'
              },
              {
                icon: '🎬',
                title: 'Studio Professionnel',
                description: 'Panneau de contrôle complet pour gérer vos sessions en direct'
              },
              {
                icon: '🏆',
                title: 'Classements Live',
                description: 'Leaderboard en temps réel avec scores et animations'
              }
            ].map((feature, index) => (
              <div
                key={index}
                className="bg-white/5 backdrop-blur-sm rounded-2xl p-8 border border-white/10 hover:bg-white/10 transition group"
              >
                <div className="text-5xl mb-4 group-hover:scale-110 transition">{feature.icon}</div>
                <h3 className="text-2xl font-bold text-white mb-3">{feature.title}</h3>
                <p className="text-white/70">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section id="how-it-works" className="py-20 px-6 bg-black/20">
        <div className="container mx-auto max-w-6xl">
          <h2 className="text-4xl md:text-5xl font-bold text-white text-center mb-16">
            Comment ça marche ?
          </h2>

          <div className="grid md:grid-cols-3 gap-12">
            {[
              {
                step: '1',
                title: 'Créez votre événement',
                description: 'Configurez vos quiz, rounds et questions depuis l\'interface admin'
              },
              {
                step: '2',
                title: 'Partagez le code',
                description: 'Les joueurs rejoignent avec un simple code à 6 caractères'
              },
              {
                step: '3',
                title: 'Animez en direct',
                description: 'Contrôlez le jeu depuis le studio, affichez sur grand écran'
              }
            ].map((step, index) => (
              <div key={index} className="text-center">
                <div className="w-20 h-20 bg-gradient-to-br from-purple-500 to-blue-500 rounded-full flex items-center justify-center text-3xl font-bold text-white mx-auto mb-6">
                  {step.step}
                </div>
                <h3 className="text-2xl font-bold text-white mb-4">{step.title}</h3>
                <p className="text-white/70 text-lg">{step.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-6">
        <div className="container mx-auto max-w-4xl">
          <div className="bg-gradient-to-r from-purple-600 to-blue-600 rounded-3xl p-12 text-center">
            <h2 className="text-4xl md:text-5xl font-bold text-white mb-6">
              Prêt à animer vos événements ?
            </h2>
            <p className="text-xl text-white/90 mb-8">
              Rejoignez des centaines d'organisateurs qui font confiance à Arena Event
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <a
                href="https://admin.arena-event.fr"
                className="px-8 py-4 bg-white text-purple-600 rounded-xl font-semibold text-lg hover:shadow-2xl transition-all transform hover:scale-105"
              >
                Accéder à l'Admin
              </a>
              <a
                href="https://studio.arena-event.fr"
                className="px-8 py-4 bg-white/10 backdrop-blur-sm text-white rounded-xl font-semibold text-lg border border-white/20 hover:bg-white/20 transition"
              >
                Découvrir le Studio
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-6 bg-black/40 backdrop-blur-sm border-t border-white/10">
        <div className="container mx-auto max-w-6xl">
          <div className="grid md:grid-cols-4 gap-8 mb-8">
            <div>
              <h4 className="text-white font-bold text-lg mb-4">Produit</h4>
              <ul className="space-y-2">
                <li><a href="#features" className="text-white/60 hover:text-white transition">Fonctionnalités</a></li>
                <li><a href="#pricing" className="text-white/60 hover:text-white transition">Tarifs</a></li>
                <li><a href="https://admin.arena-event.fr" className="text-white/60 hover:text-white transition">Admin</a></li>
                <li><a href="https://studio.arena-event.fr" className="text-white/60 hover:text-white transition">Studio</a></li>
              </ul>
            </div>
            <div>
              <h4 className="text-white font-bold text-lg mb-4">Applications</h4>
              <ul className="space-y-2">
                <li><a href="https://player.arena-event.fr" className="text-white/60 hover:text-white transition">Player (Mobile)</a></li>
                <li><a href="https://screen.arena-event.fr" className="text-white/60 hover:text-white transition">Screen (Affichage)</a></li>
                <li><a href="https://api.arena-event.fr/health" className="text-white/60 hover:text-white transition">API Status</a></li>
              </ul>
            </div>
            <div>
              <h4 className="text-white font-bold text-lg mb-4">Ressources</h4>
              <ul className="space-y-2">
                <li><a href="#" className="text-white/60 hover:text-white transition">Documentation</a></li>
                <li><a href="#" className="text-white/60 hover:text-white transition">Guide de démarrage</a></li>
                <li><a href="#" className="text-white/60 hover:text-white transition">Support</a></li>
              </ul>
            </div>
            <div>
              <h4 className="text-white font-bold text-lg mb-4">Légal</h4>
              <ul className="space-y-2">
                <li><a href="#" className="text-white/60 hover:text-white transition">Conditions d'utilisation</a></li>
                <li><a href="#" className="text-white/60 hover:text-white transition">Politique de confidentialité</a></li>
                <li><a href="#" className="text-white/60 hover:text-white transition">Mentions légales</a></li>
              </ul>
            </div>
          </div>

          <div className="border-t border-white/10 pt-8 text-center">
            <p className="text-white/60">
              © 2024 Arena Event. Tous droits réservés.
            </p>
          </div>
        </div>
      </footer>

      {/* Video Modal */}
      {showVideoModal && (
        <div
          className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-6"
          onClick={() => setShowVideoModal(false)}
        >
          <div
            className="bg-white/10 backdrop-blur-md rounded-2xl p-8 max-w-4xl w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-2xl font-bold text-white">Démo Arena Event</h3>
              <button
                onClick={() => setShowVideoModal(false)}
                className="text-white/60 hover:text-white text-4xl"
              >
                ×
              </button>
            </div>
            <div className="aspect-video bg-black/50 rounded-xl flex items-center justify-center">
              <p className="text-white/60 text-lg">Vidéo de démonstration à venir</p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
