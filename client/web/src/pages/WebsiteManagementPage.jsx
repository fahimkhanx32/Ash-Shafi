import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Menu as MenuIcon,
  Image as ImageIcon,
  Stethoscope,
  Award,
  LayoutTemplate,
  BarChart3,
  Info,
  FileText,
  Images,
  Inbox,
} from 'lucide-react';

import { PageHeader } from '../components/ui/page-header.jsx';
import { TabList } from '../components/ui/tabs.jsx';
import NavbarTab from '../components/website/NavbarTab.jsx';
import HeroBannerTab from '../components/website/HeroBannerTab.jsx';
import ServicesTab from '../components/website/ServicesTab.jsx';
import CertificatesTab from '../components/website/CertificatesTab.jsx';
import SectionsTab from '../components/website/SectionsTab.jsx';
import StatsTab from '../components/website/StatsTab.jsx';
import AboutTab from '../components/website/AboutTab.jsx';
import PagesTab from '../components/website/PagesTab.jsx';
import MediaTab from '../components/website/MediaTab.jsx';
import ContactInquiriesTab from '../components/website/ContactInquiriesTab.jsx';
import * as contactService from '../services/contactService.js';

const TAB_DEFS = [
  { value: 'sections', labelKey: 'website.tabs.sections', icon: LayoutTemplate },
  { value: 'pages', labelKey: 'website.tabs.pages', icon: FileText },
  { value: 'navbar', labelKey: 'website.tabs.navbar', icon: MenuIcon },
  { value: 'hero', labelKey: 'website.tabs.hero', icon: ImageIcon },
  { value: 'services', labelKey: 'website.tabs.services', icon: Stethoscope },
  { value: 'stats', labelKey: 'website.tabs.stats', icon: BarChart3 },
  { value: 'about', labelKey: 'website.tabs.about', icon: Info },
  { value: 'certificates', labelKey: 'website.tabs.certificates', icon: Award },
  { value: 'media', labelKey: 'website.tabs.media', icon: Images },
  { value: 'contact', labelKey: 'website.tabs.contact', icon: Inbox },
];

/**
 * FET-16 — Website Management. Everything an admin needs to run the
 * public site's homepage without a developer: reorder/hide/show any
 * section or create a brand-new one (Homepage layout), full CRUD +
 * reorder + show/hide on navbar items, the hero/banner text and
 * image-or-video background, the services grid, and the certificates
 * grid — plus, from this completion pass: the stats strip, the About
 * section, full CMS pages (Home/About/Doctor/Services/FAQ/Blog/
 * Contact/Privacy/Terms/Custom) with a draft→publish→archive
 * lifecycle, the shared media library, and the Contact-form inquiry
 * inbox. All of it real `WEBSITE_MANAGE`-gated backend calls via
 * `services/websiteService.js`/`services/contactService.js` — no mock
 * content.
 */
export default function WebsiteManagementPage() {
  const { t } = useTranslation();
  const [tab, setTab] = useState('sections');
  const [newInquiryCount, setNewInquiryCount] = useState(0);

  useEffect(() => {
    contactService
      .listContactInquiries({ status: 'NEW', limit: 1 })
      .then((result) => setNewInquiryCount(result.pagination?.total || 0))
      .catch(() => setNewInquiryCount(0));
  }, [tab]);

  const TABS = TAB_DEFS.map((tabDef) => ({
    ...tabDef,
    label: t(tabDef.labelKey),
    badge: tabDef.value === 'contact' && newInquiryCount > 0 ? newInquiryCount : undefined,
  }));

  return (
    <div>
      <PageHeader
        breadcrumbs={[{ label: t('dashboard.breadcrumb'), to: '/dashboard' }, { label: t('nav.website') }]}
        title={t('website.pageTitle')}
        description={t('website.pageDescription')}
      />

      <TabList tabs={TABS} value={tab} onChange={setTab} />

      {tab === 'sections' ? <SectionsTab /> : null}
      {tab === 'pages' ? <PagesTab /> : null}
      {tab === 'navbar' ? <NavbarTab /> : null}
      {tab === 'hero' ? <HeroBannerTab /> : null}
      {tab === 'services' ? <ServicesTab /> : null}
      {tab === 'stats' ? <StatsTab /> : null}
      {tab === 'about' ? <AboutTab /> : null}
      {tab === 'certificates' ? <CertificatesTab /> : null}
      {tab === 'media' ? <MediaTab /> : null}
      {tab === 'contact' ? <ContactInquiriesTab /> : null}
    </div>
  );
}
