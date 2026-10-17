import type { Metadata } from 'next';
import './globals.css';
export const metadata:Metadata={title:'Channel Scout — Research workspace',description:'Evidence-led content research for Indian endurance fitness.'};
export default function Layout({children}:{children:React.ReactNode}){return <html lang="en"><body>{children}</body></html>}
