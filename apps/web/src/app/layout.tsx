import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import '@/styles/globals.css';
import { Navbar } from '@/components/layout/Navbar';
import { Providers } from './providers';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'GameArena - PS5 & Xbox Tournament Platform',
  description: 'Host and join competitive gaming tournaments for PlayStation and Xbox',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <Providers>
          <div className="min-h-screen flex flex-col">
            <Navbar />
            <main className="flex-1">{children}</main>
            <footer className="border-t border-dark-800 py-8 mt-auto">
              <div className="container mx-auto px-4 text-center text-dark-400 text-sm">
                <p>&copy; {new Date().getFullYear()} GameArena. All rights reserved.</p>
              </div>
            </footer>
          </div>
        </Providers>
      </body>
    </html>
  );
}
