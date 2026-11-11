import type { Metadata, Viewport } from "next";
import Script from "next/script";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/primitives";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Meridian · Performance Intelligence",
    template: "%s · Meridian",
  },
  description:
    "Meridian is MetricStream's in-house performance intelligence platform — goals, continuous feedback, structured review cycles and calibrated talent decisions.",
  applicationName: "Meridian",
  robots: { index: false, follow: false },
  manifest: "/manifest.webmanifest",
  icons: { icon: "/icons/favicon.svg" },
  formatDetection: { email: false, telephone: false, address: false },
};

export const viewport: Viewport = {
  themeColor: "#05060a",
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  colorScheme: "dark light",
};

/**
 * Applied before first paint so the correct theme is present without a flash.
 * The choice is stored in localStorage and defaults to dark.
 */
const themeScript = `
(function(){
  try {
    var stored = localStorage.getItem('meridian.theme');
    var theme = stored || 'dark';
    var root = document.documentElement;
    if (theme === 'light') root.classList.add('light');
    root.style.colorScheme = theme;
  } catch (e) {}
})();
`;

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/*
          Theme bootstrap must run before paint. `next/script` with the
          `beforeInteractive` strategy is the supported way to get an inline
          script into the initial HTML from a Server Component — a raw
          <script> element renders but React warns that scripts rendered by a
          component never execute on the client. The body is a constant defined
          above (no user input), so there is no injection surface.
        */}
        <Script
          id="theme-bootstrap"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{ __html: themeScript }}
        />
      </head>
      <body>
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-lg focus:bg-brand-500 focus:px-4 focus:py-2 focus:text-sm focus:text-white"
        >
          Skip to content
        </a>
        <TooltipProvider>{children}</TooltipProvider>
        <Toaster />
      </body>
    </html>
  );
}
