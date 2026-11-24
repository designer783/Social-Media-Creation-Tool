import { describe, it, expect } from "vitest";
import sharp from "sharp";
import { validateSafePublicUrl, isPrivateOrReservedIp } from "@/lib/extractor/ssrf-guard";
import {
  analyzeHtmlAndCssForBrand,
  detectTopicFromContent,
  extractBrandFromWebsite,
  extractDomainImagesFromHtml,
  extractLogoDominantColors,
} from "@/lib/extractor/website-extractor";

describe("SSRF Protection, Domain Image Extraction & Topic Detection", () => {
  it("blocks localhost, loopback, RFC1918 private networks, and cloud metadata IPs", async () => {
    expect(isPrivateOrReservedIp("127.0.0.1")).toBe(true);
    expect(isPrivateOrReservedIp("10.0.0.15")).toBe(true);
    expect(isPrivateOrReservedIp("172.16.5.4")).toBe(true);
    expect(isPrivateOrReservedIp("192.168.1.1")).toBe(true);
    expect(isPrivateOrReservedIp("169.254.169.254")).toBe(true);
    expect(isPrivateOrReservedIp("::1")).toBe(true);
    expect(isPrivateOrReservedIp("93.184.216.34")).toBe(false);

    await expect(validateSafePublicUrl("http://localhost:3000/admin")).rejects.toThrow(
      /Blocked URL/
    );
    await expect(validateSafePublicUrl("http://127.0.0.1:8080")).rejects.toThrow(
      /Blocked URL/
    );
    await expect(validateSafePublicUrl("http://169.254.169.254/latest/meta-data")).rejects.toThrow(
      /Blocked URL/
    );
    await expect(
      validateSafePublicUrl("https://internal.corp.example.com", async () => ["10.24.0.8"])
    ).rejects.toThrow(/private or reserved network/);
  });

  it("extracts brand colors, fonts, domain images, and detects vehicle/automotive topics from HTML/CSS", () => {
    const sampleHtml = `
      <!doctype html>
      <html>
        <head>
          <title>Apex Motors — Electric SUV & Luxury Vehicle Dealership</title>
          <meta name="description" content="Test drive the new 2026 electric SUV and performance vehicles." />
          <meta property="og:image" content="https://apexmotors.example.com/images/hero-suv.jpg" />
          <meta name="theme-color" content="#0B2545" />
          <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@600;700&family=Plus+Jakarta+Sans:wght@400;500&display=swap" />
        </head>
        <body>
          <h1>2026 Electric Performance SUV</h1>
          <h2>Engineered for 550km Range</h2>
          <img src="/assets/showroom-coupe.png" alt="Showroom Coupe Vehicle" />
          <button class="cta">Book a Test Drive</button>
        </body>
      </html>
    `;
    const sampleCss = `
      :root {
        --brand-primary: #0B2545;
        --brand-accent: #D97706;
      }
      .cta {
        background-color: #D97706;
        border-radius: 32px;
      }
    `;

    const extracted = analyzeHtmlAndCssForBrand({
      sourceUrl: "https://apexmotors.example.com",
      html: sampleHtml,
      cssText: sampleCss,
    });

    expect(extracted.colors.primary).toBe("#0B2545");
    expect(extracted.colors.accent).toBe("#D97706");
    expect(extracted.typography.headingFont).toContain("Playfair Display");
    expect(extracted.typography.bodyFont).toContain("Plus Jakarta Sans");
    expect(extracted.visualStyle.ctaStyle.shape).toBe("pill");
    expect(extracted.extractionMeta.detectedTopic).toBe("automotive_vehicle");
    expect(extracted.extractionMeta.extractedImages).toContain(
      "https://apexmotors.example.com/images/hero-suv.jpg"
    );
    expect(extracted.extractionMeta.extractedImages).toContain(
      "https://apexmotors.example.com/assets/showroom-coupe.png"
    );
  });

  it("accurately classifies automotive/vehicle topics and extracts domain image URLs", () => {
    expect(detectTopicFromContent("Luxury Car Rental & Chauffeur Fleet")).toBe(
      "automotive_vehicle"
    );
    expect(detectTopicFromContent("Electric Vehicle Charging & Dealership")).toBe(
      "automotive_vehicle"
    );

    const images = extractDomainImagesFromHtml(
      "https://motors.example.com",
      `<meta property="og:image" content="/media/featured-car.webp" /><img src="https://cdn.example.com/sedan.jpg" />`
    );
    expect(images).toEqual([
      "https://motors.example.com/media/featured-car.webp",
      "https://cdn.example.com/sedan.jpg",
    ]);
  });

  it("extracts dominant brand colors from an uploaded logo image via Sharp", async () => {
    const logoBuffer = await sharp({
      create: {
        width: 120,
        height: 120,
        channels: 4,
        background: { r: 16, g: 128, b: 96, alpha: 1 },
      },
    })
      .png()
      .toBuffer();

    const colors = await extractLogoDominantColors(logoBuffer);
    expect(colors.length).toBeGreaterThanOrEqual(1);
    expect(colors[0]).toBe("#108060");
  });

  it("activates manual setup fallback gracefully when a website blocks automated access", async () => {
    const result = await extractBrandFromWebsite({
      websiteUrl: "https://protected-brand.example.com",
      brandName: "Protected Brand",
      customDnsResolver: async () => ["93.184.216.34"],
      customFetch: (async () =>
        new Response("Forbidden", { status: 403 })) as unknown as typeof fetch,
    });

    expect(result.extractionMeta.fallbackUsed).toBe(true);
    expect(result.extractionMeta.fallbackReason).toContain("HTTP 403");
    expect(result.colors.primary).toBeDefined();
  });

  it("decodes HTML entities in page titles, meta descriptions, and extracted headings", () => {
    const htmlWithEntities = `
      <!doctype html>
      <html>
        <head>
          <title>History &amp; Specs &#39;Official&#39;</title>
          <meta name="description" content="Vehicle history &amp; specifications by &quot;EU Check&quot;." />
        </head>
        <body>
          <h1>Reliable Checks &amp; Reports</h1>
        </body>
      </html>
    `;
    const extracted = analyzeHtmlAndCssForBrand({
      sourceUrl: "https://entity-brand.example.com",
      html: htmlWithEntities,
      cssText: "",
    });
    expect(extracted.extractionMeta.pageTitle).toBe("History & Specs 'Official'");
    expect(extracted.extractionMeta.pageDescription).toBe(
      'Vehicle history & specifications by "EU Check".'
    );
    expect(extracted.extractionMeta.extractedHeadings).toContain(
      "Reliable Checks & Reports"
    );
  });
});
