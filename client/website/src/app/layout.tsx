import type { Metadata } from 'next';
import './globals.css';
import { ThemeRegistry } from '@/components/ThemeRegistry/ThemeRegistry';
import { Navbar } from '@/components/Navbar/Navbar';
import { Footer } from '@/components/Footer/Footer';
import { I18nProvider } from '@/lib/i18nContext';
import { fetchNavbarTree } from '@/lib/api';

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'https://ash-shafi.com'),
  title: {
    default: 'Ash-Shāfī | Gynecology & Obstetrics Specialist',
    template: '%s | Ash-Shāfī',
  },
  description:
    'Ash-Shāfī is a BM&DC registered gynecologist and obstetrician providing compassionate, expert women\'s healthcare in Dhaka, Bangladesh.',
  keywords: [
    'gynecologist Dhaka',
    'obstetrician Bangladesh',
    'women\'s health doctor',
    'pregnancy care Dhaka',
    'Ash-Shāfī',
    'MBBS gynecology',
    'prenatal care Bangladesh',
  ],
  openGraph: {
    type: 'website',
    locale: 'en_US',
    siteName: 'Ash-Shāfī',
    title: 'Ash-Shāfī | Gynecology & Obstetrics Specialist',
    description:
      'Expert women\'s healthcare including gynecological care, pregnancy support, and preventive health services in Dhaka, Bangladesh.',
    images: [
      {
        url: 'https://res.cloudinary.com/fhsrf5ps/image/upload/v1786857858/ash-shafi/website/media/bb716376-f52e-4442-89ae-e075d1d2d46b.webp.webp',
        width: 1200,
        height: 630,
        alt: 'Ash-Shāfī',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Ash-Shāfī | Gynecology & Obstetrics Specialist',
    description:
      'Compassionate women\'s healthcare: gynecology, obstetrics, and more in Dhaka, Bangladesh.',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Server-side fetch navbar for initial hydration (with ISR)
  const navbarItems = await fetchNavbarTree();

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Preconnect for Google Fonts */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />

        {/* JSON-LD: Doctor Schema */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'Physician',
              name: 'Ash-Shāfī',
              description:
                'BM&DC registered gynecologist and obstetrician providing expert women\'s healthcare in Dhaka, Bangladesh.',
              url: process.env.NEXT_PUBLIC_SITE_URL || 'https://ash-shafi.com',
              image:
                'https://res.cloudinary.com/fhsrf5ps/image/upload/v1786857858/ash-shafi/website/media/bb716376-f52e-4442-89ae-e075d1d2d46b.webp.webp',
              telephone: '+8801703613394',
              email: 'antaraadiba5@gmail.com',
              address: {
                '@type': 'PostalAddress',
                streetAddress: 'Mohammadpur',
                addressLocality: 'Dhaka',
                addressCountry: 'BD',
              },
              medicalSpecialty: ['Gynecology', 'Obstetrics'],
              availableService: [
                { '@type': 'MedicalProcedure', name: 'Gynecological Care' },
                { '@type': 'MedicalProcedure', name: 'Pregnancy & Prenatal Care' },
                { '@type': 'MedicalProcedure', name: 'Menstrual Health' },
                { '@type': 'MedicalProcedure', name: 'Fertility Consultation' },
                { '@type': 'MedicalProcedure', name: 'Menopause Management' },
                { '@type': 'MedicalProcedure', name: 'Preventive Care' },
              ],
            }),
          }}
        />
      </head>
      <body>
        <ThemeRegistry>
          <I18nProvider>
            <Navbar initialItems={navbarItems} />
            <main>{children}</main>
            <Footer />
          </I18nProvider>
        </ThemeRegistry>
      </body>
    </html>
  );
}
