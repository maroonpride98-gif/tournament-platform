import Link from 'next/link';
import { Trophy, Users, Gamepad2, DollarSign, Zap, Shield } from 'lucide-react';

const features = [
  {
    icon: Trophy,
    title: 'Tournament Brackets',
    description: 'Single elimination, double elimination, round robin, and Swiss formats',
  },
  {
    icon: Users,
    title: 'Team Management',
    description: 'Create teams, manage rosters, and compete together',
  },
  {
    icon: Gamepad2,
    title: 'All Games',
    description: 'Support for PS5 and Xbox games across all genres',
  },
  {
    icon: DollarSign,
    title: 'Prize Pools',
    description: 'Collect entry fees and distribute prizes automatically',
  },
  {
    icon: Zap,
    title: 'Real-time Updates',
    description: 'Live bracket updates, chat, and match notifications',
  },
  {
    icon: Shield,
    title: 'Fair Play',
    description: 'Dispute resolution and admin tools for fair competition',
  },
];

const stats = [
  { label: 'Active Players', value: '10,000+' },
  { label: 'Tournaments Hosted', value: '500+' },
  { label: 'Prize Money Awarded', value: '$50,000+' },
  { label: 'Games Supported', value: '50+' },
];

export default function HomePage() {
  return (
    <div>
      {/* Hero Section */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary-900/20 via-dark-900 to-dark-950" />
        <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-10" />
        <div className="container mx-auto px-4 py-24 relative">
          <div className="max-w-4xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-primary-500/10 border border-primary-500/20 rounded-full text-primary-400 text-sm mb-8">
              <Zap className="w-4 h-4" />
              The Ultimate Gaming Tournament Platform
            </div>
            <h1 className="text-5xl md:text-7xl font-bold text-white mb-6 leading-tight">
              Compete. Win.{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary-400 to-primary-600">
                Dominate.
              </span>
            </h1>
            <p className="text-xl text-dark-300 mb-10 max-w-2xl mx-auto">
              Host and join competitive gaming tournaments for PlayStation 5 and Xbox.
              Create brackets, manage teams, and compete for prizes.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/tournaments" className="btn-primary text-lg px-8 py-3">
                Browse Tournaments
              </Link>
              <Link href="/auth/register" className="btn-outline text-lg px-8 py-3">
                Create Account
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="border-y border-dark-800 bg-dark-900/50">
        <div className="container mx-auto px-4 py-12">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {stats.map((stat) => (
              <div key={stat.label} className="text-center">
                <div className="text-3xl md:text-4xl font-bold text-white mb-2">
                  {stat.value}
                </div>
                <div className="text-dark-400">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-24">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
              Everything You Need to Compete
            </h2>
            <p className="text-dark-400 max-w-2xl mx-auto">
              GameArena provides all the tools you need to organize and participate in
              professional-grade gaming tournaments.
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature) => (
              <div key={feature.title} className="card hover:border-primary-500/50 transition-colors">
                <div className="w-12 h-12 bg-primary-500/10 rounded-lg flex items-center justify-center mb-4">
                  <feature.icon className="w-6 h-6 text-primary-400" />
                </div>
                <h3 className="text-xl font-semibold text-white mb-2">{feature.title}</h3>
                <p className="text-dark-400">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 bg-gradient-to-b from-dark-900 to-primary-950/20">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
              Ready to Start Competing?
            </h2>
            <p className="text-dark-300 mb-8">
              Join thousands of gamers already competing on GameArena.
              Create your account and enter your first tournament today.
            </p>
            <Link href="/auth/register" className="btn-primary text-lg px-8 py-3">
              Get Started Free
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
