import type { Metadata } from 'next';
import About from '@/components/About/About';

export const metadata: Metadata = {
  title: 'About Ash-Shāfī',
  description:
    'Learn about Ash-Shāfī — a BM&DC registered gynecologist and obstetrician with clinical experience in women\'s health, pregnancy care, and obstetrics in Dhaka, Bangladesh.',
  openGraph: {
    title: 'About Ash-Shāfī',
    description:
      'BM&DC registered gynecologist and obstetrician providing expert women\'s healthcare in Bangladesh.',
    images: [
      'https://res.cloudinary.com/fhsrf5ps/image/upload/v1786857858/ash-shafi/website/media/bb716376-f52e-4442-89ae-e075d1d2d46b.webp.webp',
    ],
  },
};

export default function AboutPage() {
  return <About />;
}
