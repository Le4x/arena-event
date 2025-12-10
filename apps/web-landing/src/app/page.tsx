'use client';

import { useState } from 'react';

export default function LandingPage() {
  const [showVideo, setShowVideo] = useState(false);

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-indigo-900 to-blue-900">
      {/* Header */}
      <header className="fixed top-0 w-full bg-black/20 backdrop-blur-lg border-b border-white/10 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center space-x-3">
              <div className="text-4xl">🎮</div>
              <div>
                <h1 className="text-2xl font-black text-white">Arena Event</h1>
                <p className="text-xs text-purple-300">Interactive Game Platform</p>
              </div>
            </div>
            <nav className="hidden md:flex space-x-6">
              <a href="#features" className="text-white/80 hover:text-white transition">Fonctionnalités</a>
              <a href="#how-it-works" className="text-white/80 hover:text-white transition">Comment ça marche</a>
              <a href="#pricing" className="text-white/80 hover:text-white transition">Tarifs</a>
            </nav>
            <a
              href="https://admin.arena-event.fr"
              className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white px-6 py-2 rounded-full font-semibold hover:from-purple-700 hover:to-indigo-700 transition shadow-lg"
            >
              Connexion
            </a>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-4">
        <div className="max-w-7xl mx-auto text-center">
          <div className="mb-8">
            <span className="bg-purple-500/20 text-purple-300 px-4 py-2 rounded-full text-sm font-semibold border border-purple-500/30">
              🎉 Nouvelle plateforme de jeu interactive
            </span>
          </div>

          <h1 className="text-5xl md:text-7xl font-black text-white mb-6 leading-tight">
            Transformez vos événements<br />
            en <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-400">expériences inoubliables</span>
          </h1>

          <p className="text-xl md:text-2xl text-purple-200 mb-12 max-w-3xl mx-auto">
            Quiz interactifs, blind tests, buzzers... Engagez vos participants comme jamais avec Arena Event
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <a
              href="https://admin.arena-event.fr"
              className="bg-gradient-to-r from-purple-600 to-pink-600 text-white px-8 py-4 rounded-2xl font-bold text-lg hover:from-purple-700 hover:to-pink-700 transition transform hover:scale-105 shadow-2xl"
            >
              🚀 Commencer maintenant
            </a>
            <button
              onClick={() => setShowVideo(true)}
              className="bg-white/10 backdrop-blur-sm text-white px-8 py-4 rounded-2xl font-bold text-lg hover:bg-white/20 transition border border-white/20"
            >
              ▶️ Voir la démo
            </button>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-8 mt-20 max-w-3xl mx-auto">
            <div className="text-center">
              <div className="text-4xl md:text-5xl font-black text-white mb-2">80+</div>
              <div className="text-purple-300 text-sm md:text-base">Joueurs simultanés</div>
            </div>
            <div className="text-center">
              <div className="text-4xl md:text-5xl font-black text-white mb-2">5+</div>
              <div className="text-purple-300 text-sm md:text-base">Types de jeux</div>
            </div>
            <div className="text-center">
              <div className="text-4xl md:text-5xl font-black text-white mb-2">100%</div>
              <div className="text-purple-300 text-sm md:text-base">Temps réel</div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-black text-white mb-4">
              Tout ce dont vous avez besoin
            </h2>
            <p className="text-xl text-purple-300">
              Une plateforme complète pour vos événements interactifs
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {/* Feature 1 */}
            <div className="bg-white/5 backdrop-blur-sm p-8 rounded-2xl border border-white/10 hover:border-purple-500/50 transition">
              <div className="text-5xl mb-4">📱</div>
              <h3 className="text-2xl font-bold text-white mb-3">Multi-device</h3>
              <p className="text-purple-200">
                Chaque participant joue depuis son smartphone. Pas besoin d'installation, juste un code à entrer.
              </p>
            </div>

            {/* Feature 2 */}
            <div className="bg-white/5 backdrop-blur-sm p-8 rounded-2xl border border-white/10 hover:border-purple-500/50 transition">
              <div className="text-5xl mb-4">⚡</div>
              <h3 className="text-2xl font-bold text-white mb-3">Temps réel</h3>
              <p className="text-purple-200">
                Synchronisation instantanée entre tous les appareils. Buzzers, scores et classements en direct.
              </p>
            </div>

            {/* Feature 3 */}
            <div className="bg-white/5 backdrop-blur-sm p-8 rounded-2xl border border-white/10 hover:border-purple-500/50 transition">
              <div className="text-5xl mb-4">🎯</div>
              <h3 className="text-2xl font-bold text-white mb-3">Types de questions variés</h3>
              <p className="text-purple-200">
                QCM, Vrai/Faux, Buzzer, Blind Test, Questions ouvertes... Variez les plaisirs!
              </p>
            </div>

            {/* Feature 4 */}
            <div className="bg-white/5 backdrop-blur-sm p-8 rounded-2xl border border-white/10 hover:border-purple-500/50 transition">
              <div className="text-5xl mb-4">🎨</div>
              <h3 className="text-2xl font-bold text-white mb-3">Interface moderne</h3>
              <p className="text-purple-200">
                Design élégant et intuitif. Vos participants adorent l'expérience visuelle.
              </p>
            </div>

            {/* Feature 5 */}
            <div className="bg-white/5 backdrop-blur-sm p-8 rounded-2xl border border-white/10 hover:border-purple-500/50 transition">
              <div className="text-5xl mb-4">🏆</div>
              <h3 className="text-2xl font-bold text-white mb-3">Mode Finale</h3>
              <p className="text-purple-200">
                Jokers exclusifs, éliminations progressives... Pour des finales palpitantes!
              </p>
            </div>

            {/* Feature 6 */}
            <div className="bg-white/5 backdrop-blur-sm p-8 rounded-2xl border border-white/10 hover:border-purple-500/50 transition">
              <div className="text-5xl mb-4">📊</div>
              <h3 className="text-2xl font-bold text-white mb-3">Statistiques en direct</h3>
              <p className="text-purple-200">
                Monitoring en temps réel, classements automatiques, exports de résultats.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="py-20 px-4 bg-black/20">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-black text-white mb-4">
              Comment ça marche ?
            </h2>
            <p className="text-xl text-purple-300">
              3 étapes pour lancer votre événement
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="bg-purple-600 w-16 h-16 rounded-full flex items-center justify-center text-2xl font-black text-white mx-auto mb-4">
                1
              </div>
              <h3 className="text-xl font-bold text-white mb-2">Créez votre événement</h3>
              <p className="text-purple-200">
                Connectez-vous à l'admin, créez votre quiz avec vos questions
              </p>
            </div>

            <div className="text-center">
              <div className="bg-purple-600 w-16 h-16 rounded-full flex items-center justify-center text-2xl font-black text-white mx-auto mb-4">
                2
              </div>
              <h3 className="text-xl font-bold text-white mb-2">Partagez le code</h3>
              <p className="text-purple-200">
                Les participants rejoignent avec un simple code à 6 chiffres
              </p>
            </div>

            <div className="text-center">
              <div className="bg-purple-600 w-16 h-16 rounded-full flex items-center justify-center text-2xl font-black text-white mx-auto mb-4">
                3
              </div>
              <h3 className="text-xl font-bold text-white mb-2">Lancez le jeu!</h3>
              <p className="text-purple-200">
                Contrôlez tout depuis le Studio, affichez sur grand écran
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <div className="bg-gradient-to-r from-purple-600 to-pink-600 p-12 rounded-3xl shadow-2xl">
            <h2 className="text-4xl md:text-5xl font-black text-white mb-6">
              Prêt à transformer vos événements ?
            </h2>
            <p className="text-xl text-white/90 mb-8">
              Rejoignez les organisateurs qui font confiance à Arena Event
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <a
                href="https://admin.arena-event.fr"
                className="bg-white text-purple-600 px-8 py-4 rounded-2xl font-bold text-lg hover:bg-gray-100 transition transform hover:scale-105 shadow-lg"
              >
                Accéder à l'Admin
              </a>
              <a
                href="https://studio.arena-event.fr"
                className="bg-white/20 backdrop-blur-sm text-white px-8 py-4 rounded-2xl font-bold text-lg hover:bg-white/30 transition border border-white/30"
              >
                Accéder au Studio
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-black/30 border-t border-white/10 py-12 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="grid md:grid-cols-4 gap-8 mb-8">
            <div>
              <div className="flex items-center space-x-2 mb-4">
                <div className="text-3xl">🎮</div>
                <div className="text-xl font-black text-white">Arena Event</div>
              </div>
              <p className="text-purple-300 text-sm">
                La plateforme de jeux interactifs pour vos événements
              </p>
            </div>

            <div>
              <h4 className="text-white font-bold mb-3">Plateformes</h4>
              <ul className="space-y-2">
                <li><a href="https://admin.arena-event.fr" className="text-purple-300 hover:text-white transition">Admin</a></li>
                <li><a href="https://studio.arena-event.fr" className="text-purple-300 hover:text-white transition">Studio</a></li>
                <li><a href="https://player.arena-event.fr" className="text-purple-300 hover:text-white transition">Player</a></li>
                <li><a href="https://screen.arena-event.fr" className="text-purple-300 hover:text-white transition">Screen</a></li>
              </ul>
            </div>

            <div>
              <h4 className="text-white font-bold mb-3">Ressources</h4>
              <ul className="space-y-2">
                <li><a href="#" className="text-purple-300 hover:text-white transition">Documentation</a></li>
                <li><a href="#" className="text-purple-300 hover:text-white transition">Guide de démarrage</a></li>
                <li><a href="#" className="text-purple-300 hover:text-white transition">FAQ</a></li>
                <li><a href="#" className="text-purple-300 hover:text-white transition">Support</a></li>
              </ul>
            </div>

            <div>
              <h4 className="text-white font-bold mb-3">Légal</h4>
              <ul className="space-y-2">
                <li><a href="#" className="text-purple-300 hover:text-white transition">Mentions légales</a></li>
                <li><a href="#" className="text-purple-300 hover:text-white transition">CGU</a></li>
                <li><a href="#" className="text-purple-300 hover:text-white transition">Confidentialité</a></li>
              </ul>
            </div>
          </div>

          <div className="border-t border-white/10 pt-8 text-center text-purple-300 text-sm">
            <p>&copy; 2024 Arena Event. Tous droits réservés. Optimisé pour 80+ joueurs simultanés.</p>
          </div>
        </div>
      </footer>

      {/* Video Modal */}
      {showVideo && (
        <div
          className="fixed inset-0 bg-black/90 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          onClick={() => setShowVideo(false)}
        >
          <div className="max-w-4xl w-full bg-gray-900 rounded-2xl p-2" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-2 px-4 pt-2">
              <h3 className="text-white font-bold">Démo Arena Event</h3>
              <button
                onClick={() => setShowVideo(false)}
                className="text-white hover:text-gray-300"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="aspect-video bg-gradient-to-br from-purple-900 to-indigo-900 rounded-xl flex items-center justify-center">
              <p className="text-white text-xl">🎬 Vidéo de démonstration (à venir)</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
