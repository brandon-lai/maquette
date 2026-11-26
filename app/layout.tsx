import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

const body = localFont({
  src: [
    {
      path: "../node_modules/@fontsource/karla/files/karla-latin-400-normal.woff2",
      weight: "400",
    },
    {
      path: "../node_modules/@fontsource/karla/files/karla-latin-700-normal.woff2",
      weight: "700",
    },
  ],
  variable: "--font-body",
  display: "swap",
});
const title = localFont({
  src: "../node_modules/@fontsource/bodoni-moda/files/bodoni-moda-latin-400-normal.woff2",
  variable: "--font-title",
  display: "swap",
});
const mono = localFont({
  src: "../node_modules/@fontsource/dm-mono/files/dm-mono-latin-400-normal.woff2",
  variable: "--font-measure",
  display: "swap",
});
export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_APP_URL ??
      "https://maquette-delta-ruddy.vercel.app",
  ),
  title: "Maquette | Measure first. Move once.",
  description:
    "Turn your measured room and furniture into a warm 3D miniature. Try layouts with real clearances before moving or buying.",
  openGraph: {
    title: "Maquette",
    description: "Your room, your pieces, room to move.",
    images: [
      {
        url: "/opengraph-image",
        width: 1200,
        height: 630,
        alt: "A measured paper room plan and its miniature, on Maquette's architect desk",
      },
    ],
  },
  twitter: { card: "summary_large_image" },
};
export const viewport: Viewport = {
  themeColor: "#f6efdf",
  colorScheme: "light",
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${body.variable} ${title.variable} ${mono.variable}`}
    >
      <body>
        <TooltipProvider>
          <>
            {children}
            <Toaster theme="light" position="bottom-center" />
          </>
        </TooltipProvider>
      </body>
    </html>
  );
}
