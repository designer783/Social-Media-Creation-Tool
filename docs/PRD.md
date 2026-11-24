# Social Media Studio
## Product Requirements Document (PRD)

**Version:** 1.0  
**Product:** Social Media Studio  
**Product Type:** Multi-Brand Social Media Creative SaaS  
**Development Platform:** Google Antigravity  
**Release:** MVP

---

## 1. Product Overview

Social Media Studio is an AI-powered social media creative production platform that enables users to manage multiple brands, extract brand identities automatically from websites, generate marketing content and create consistent social media graphics for multiple platforms.

Users can add a new domain or select an existing saved brand, provide its website URL and upload its logo. The platform automatically analyzes the website to extract brand colors, typography, visual styles and other brand identity elements.

Once the brand identity is established, users can provide their own content, SEO keywords or campaign topics. Alternatively, they can use AI to generate content, captions and hashtags.

The platform then generates three creative variations for each post using a hybrid AI generation system.

AI generates visual assets, while a deterministic rendering engine handles typography, text, logo placement, colors, dimensions and layout.

Users can review, edit, approve and download their final creatives in platform-specific dimensions.

### Product vision

Make professional, brand-consistent social media content creation accessible through one automated creative production platform.

### Core value proposition

Enter a website, establish its brand identity, create content and generate ready-to-publish social media graphics without designing each post manually.

---

## 2. Target Audience

The platform should support two primary customer groups.

### A. Businesses and individual creators
- Small and medium-sized businesses.
- E-commerce businesses.
- Marketing professionals.
- Individual content creators.
- Companies managing their own social media presence.

### B. Agencies and freelancers
- Digital marketing agencies.
- Social media management agencies.
- Freelance graphic designers.
- Marketing consultants.
- Businesses managing multiple client brands.

### Workspace model

The platform must support multiple independent workspaces.

Each workspace should maintain its own:
- Brands and domains.
- Brand identity kits.
- Campaigns.
- Content.
- Generated creatives.
- Approval history.
- Exported assets.
- Workspace members and permissions.

One workspace must not expose its private information or assets to another workspace.

---

## 3. Core Product Workflow

The primary user journey:

1. User creates an account and workspace.
2. User creates a new brand or selects an existing brand.
3. User enters the domain and website URL.
4. User uploads the brand logo.
5. Platform analyzes the website and extracts its visual identity.
6. User reviews and approves the generated brand kit.
7. User creates a new social media campaign.
8. User enters content, SEO keywords or a campaign topic.
9. User chooses manual content or AI-generated content.
10. User selects social media platforms and formats.
11. Platform generates three design variations.
12. User reviews the creatives.
13. User edits, regenerates or approves the designs.
14. User downloads individual creatives or the complete campaign ZIP.

The workflow should be simple, guided and accessible to non-designers.

---

## 4. Functional Requirements

### Module 1: Authentication and Workspace Management

Users should be able to:
- Register and log in.
- Create a workspace.
- Rename a workspace.
- Manage workspace settings.
- Access their saved projects.
- Manage multiple brands.
- Switch between workspaces.

Workspace data must remain isolated.

### Module 2: Brand and Domain Management

Users should be able to add brands in two ways:

**Option A: Add a new brand**
- Enter brand name.
- Enter domain name.
- Enter website URL.
- Upload brand logo.
- Start automatic brand analysis.

**Option B: Select an existing brand**
- Browse previously created brands.
- Select a saved domain.
- Reuse its approved brand identity.
- Start a new campaign without repeating the extraction process.

Each brand should have its own independent brand identity.

The system must also allow users to:
- Edit brand information.
- Replace logos.
- Update website URLs.
- Re-extract brand styles.
- Manually override extracted styles.
- Save multiple versions of brand kits.

### Module 3: Automatic Brand Identity Extraction

This is one of the primary features of the product.

When users submit a website URL and logo, the platform should analyze the website and generate a structured brand kit.

**Required extraction fields:**

| Category | Information |
|---|---|
| Logo | Uploaded primary logo |
| Primary color | Main brand color |
| Secondary colors | Supporting colors |
| Accent colors | Highlight and CTA colors |
| Background colors | Light and dark backgrounds |
| Heading typography | H1–H6 font families and styles |
| Body typography | Paragraph font family |
| Font weights | Regular, medium, semibold, bold |
| Typography hierarchy | Heading and body scale |
| Design characteristics | Minimal, modern, premium, bold, corporate, etc. |
| Button styles | CTA shape, colors and treatments |
| Visual characteristics | Border radius, spacing and common design patterns |

**Extraction process:**

1. Retrieve publicly accessible website pages.
2. Analyze HTML and CSS.
3. Identify frequently used brand colors.
4. Identify font families and weights.
5. Inspect logos and visual assets.
6. Capture website screenshots where possible.
7. Analyze the overall visual design.
8. Generate a structured brand identity profile.
9. Present the extracted brand kit for review.

The system should prioritize recurring brand styles rather than extracting every color and font found on a website.

Users must be able to manually adjust all important brand identity properties.

If a website blocks automated access, the system should provide a fallback option for manual brand setup.

### Module 4: Content Creation and SEO

Content creation should support three input methods.

**A. User-provided content**

Users can provide:
- Post title.
- Main content.
- Description.
- SEO keywords.
- Hashtags.
- CTA.
- Optional reference URL.

**B. AI-generated content**

Users provide:
- Campaign topic.
- Campaign objective.
- Optional SEO keywords.
- Optional target audience.
- Optional tone of voice.

AI generates:
- Post title.
- Main text.
- Supporting copy.
- Captions.
- Hashtags.
- CTA suggestions.

**C. Website-based content generation**

Users can select a saved brand and request content based on its website.

The system should analyze relevant website information and generate content based on actual products, services and brand messaging.

The AI must not invent unsupported product specifications, prices, promotions or business claims.

**SEO keywords must remain optional.**

Users should be able to generate content without entering any keywords.

### Module 5: Social Media Platform Selection

The initial MVP should support:

- Instagram
- Facebook
- LinkedIn
- X
- Pinterest
- TikTok

Users can select one or multiple platforms.

The platform should support configurable creative dimensions for each selected platform.

**Initial export presets:**

| Platform | Format | Dimensions |
|---|---|---|
| Instagram | Square | 1080 × 1080 |
| Instagram | Portrait | 1080 × 1350 |
| Facebook | Square | 1080 × 1080 |
| LinkedIn | Landscape | 1200 × 627 |
| X | Landscape | 1600 × 900 |
| Pinterest | Portrait | 1000 × 1500 |
| TikTok | Vertical | 1080 × 1920 |

The platform should allow multiple formats for the same social network.

Platform dimensions should be configurable rather than hardcoded throughout the application.

### Module 6: Hybrid AI Creative Generation Engine

The creative generation system must use a hybrid approach.

**Part A: AI-generated visual assets**

AI generates:
- Backgrounds.
- Product scenes.
- Illustrations.
- Supporting graphics.
- Decorative elements.
- Campaign-specific visual assets.

**Part B: Deterministic design renderer**

The rendering engine handles:
- Exact text.
- Typography.
- Brand colors.
- Logo placement.
- Text hierarchy.
- Spacing.
- Layout.
- CTA elements.
- Image cropping.
- Platform-specific dimensions.

AI-generated images must not be trusted to render final text, logos or exact brand elements.

The rendering engine must preserve all approved text and brand assets accurately.

### Design variation requirements

Every creative generation request must produce three design variations.

Each variation should have:
- Different visual composition.
- Different image/background treatment.
- Different layout arrangement.
- Consistent brand colors.
- Consistent typography.
- Correct logo placement.
- Identical approved messaging unless the user explicitly requests otherwise.

Users should be able to select their preferred variation.

### Module 7: Brand Consistency Engine

This is a critical system requirement.

The platform must ensure that creatives belonging to the same brand maintain a consistent visual identity.

The system should enforce:

- Approved color palette.
- Approved typography.
- Logo usage rules.
- Consistent text hierarchy.
- Consistent CTA styling.
- Brand-specific spacing.
- Consistent image treatments.
- Approved design templates.

The three variations may have different compositions, but they must still look like they belong to the same brand.

The same brand kit must be reused for future campaigns unless the user approves an update.

Different brands must never share brand-specific design settings unintentionally.

### Module 8: Creative Review and Approval

Users must be able to review generated creatives before downloading them.

Required features:

- Preview all generated variations.
- Filter previews by social platform.
- Select preferred designs.
- Edit text.
- Edit hashtags and captions.
- Change colors within approved brand settings.
- Replace visual assets.
- Adjust logo positioning.
- Regenerate a creative.
- Regenerate background only.
- Regenerate one selected platform format.
- Approve individual creatives.
- Approve multiple creatives together.
- Maintain previous versions.

Approval must be required before a creative is included in the approved export package.

### Module 9: Basic Creative Editor

The MVP should include a basic editing interface.

Users should be able to:
- Edit text.
- Change font size and weight within approved limits.
- Change colors.
- Replace images.
- Change logo placement.
- Adjust alignment.
- Modify spacing.
- Preview the final output.

The editor should not require advanced graphic design knowledge.

Advanced editing features such as unlimited layers, complex vector editing, advanced masking and detailed object manipulation should be postponed.

### Module 10: Export and Download

Users must be able to:
- Download individual creatives.
- Download approved creatives in bulk.
- Export PNG.
- Export WebP.
- Download the complete campaign as ZIP.
- Organize exports by brand, campaign and platform.

Example folder structure:

Brand Name/
- Campaign Name/
  - Instagram/
  - Facebook/
  - LinkedIn/
  - X/
  - Pinterest/
  - TikTok/

All exported images must match their selected dimensions.

The platform must preserve image quality and ensure that text and logos remain sharp.

---

## 5. AI and Technology Requirements

The MVP should prioritize free and open-source technologies wherever practical.

Potential technology candidates:

| Technology | Purpose |
|---|---|
| FLUX models | AI image generation |
| Stable Diffusion | Alternative image generation |
| ComfyUI | Visual AI workflow orchestration |
| Hugging Face | Model discovery and inference options |
| Sharp | Image processing and resizing |
| Playwright | Website inspection and screenshots |
| CSS parsing tools | Color and typography extraction |

These are candidates, not mandatory technology selections. Final selections should follow the architecture and infrastructure assessment.

### AI provider abstraction

The image-generation system must be provider-independent.

The application should support replacing one model or inference provider without changing the entire creative generation system.

### Cost requirements

- Prefer free and open-source model options.
- Avoid unnecessary paid API dependencies.
- Support local or self-hosted inference where feasible.
- Allow configurable AI providers.
- Track generation failures and processing costs.
- Provide graceful fallbacks when an AI service is unavailable.

Free model availability must not be confused with free GPU inference or hosting.

---

## 6. Dashboard and Navigation Requirements

The MVP should have the following navigation:

1. Dashboard
2. Brands & Domains
3. Brand Kits
4. Creative Studio
5. Content Library
6. Approvals
7. Exported Creatives
8. Settings

### Dashboard

The dashboard should provide:
- Total brands.
- Total campaigns.
- Total generated creatives.
- Pending approvals.
- Recently generated creatives.
- Recent campaigns.
- Quick-start campaign action.

The dashboard should focus on getting users into the creative production workflow quickly.

---

## 7. Non-Functional Requirements

### Design and UX

- Modern, professional SaaS interface.
- Clean and intuitive navigation.
- Desktop and mobile responsive.
- Mobile-first usability.
- Clear visual hierarchy.
- Minimal unnecessary interface elements.
- No generic AI-looking dashboard design.
- Reusable design components.
- Consistent interactions across modules.

### Performance

- Avoid blocking the entire application during image generation.
- Display generation progress.
- Support background processing.
- Allow users to navigate while generation continues.
- Store intermediate results.
- Support retries after failed generations.

### Security

- Workspace-level data isolation.
- Secure authentication.
- Protected uploaded files.
- Safe website URL processing.
- Prevent private network and localhost access through URL extraction.
- Validate uploaded files and image formats.
- Restrict access to private brand assets.

### Reliability

- Preserve campaign data.
- Preserve approved designs.
- Maintain generation history.
- Handle failed AI requests.
- Support retry and recovery.
- Avoid duplicate generation jobs.

---

## 8. MVP Exclusions

The following features are explicitly excluded from the first release.

### Social media automation
- Social media account connections.
- OAuth integrations.
- Direct publishing.
- Scheduled posting.
- Automated recurring posts.
- Content calendar.
- Social engagement management.

### Video generation
- Text-to-video.
- Image-to-video.
- AI voiceovers.
- Video editing.
- Animated campaign production.

### Advanced design tools
- Complex layer management.
- Advanced vector editing.
- Professional animation timelines.
- Full Photoshop/Canva-style editing.

These features may be considered for future releases.

---

## 9. Future Product Roadmap

### Phase 1 — MVP
- Workspace management.
- Brand/domain management.
- Brand identity extraction.
- Content generation.
- SEO keyword support.
- AI image generation.
- Three design variations.
- Multi-platform rendering.
- Brand consistency.
- Basic editor.
- Review and approval.
- Export and download.

### Phase 2 — Social Media Automation
- Social media account connections.
- OAuth authentication.
- Scheduled posts.
- Direct publishing.
- Content calendar.
- Recurring campaigns.
- Publishing status tracking.
- Analytics and reporting.

### Phase 3 — Advanced AI Creative Studio
- Open-source video generation integration.
- Text-to-video.
- Image-to-video.
- AI voiceovers.
- Animated social media graphics.
- Advanced editor.
- More AI creative styles.
- Advanced brand template customization.

---

## 10. MVP Acceptance Criteria

The MVP will be considered functionally ready when the following requirements are satisfied.

### Workspace and brand management
- Users can create and access independent workspaces.
- Users can add multiple domains.
- Users can select previously saved brands.
- Each brand maintains its own identity settings.

### Brand extraction
- Website colors can be extracted.
- Typography can be identified where publicly available.
- Logo upload works.
- Users can manually edit extracted styles.
- Approved brand kits can be saved and reused.

### Content generation
- Users can enter their own content.
- Users can generate content using AI.
- SEO keywords are optional.
- Hashtags can be generated.
- Users can choose shared or platform-adapted content.

### Creative generation
- The system produces three variations.
- Each variation uses the selected brand identity.
- Exact approved text is preserved.
- Logos are rendered accurately.
- Platform dimensions are correct.
- Users can regenerate individual creatives.

### Editing and approval
- Users can edit basic creative properties.
- Users can approve and reject creatives.
- Previous versions are retained.
- Only approved creatives are included in approved exports.

### Export
- PNG and WebP downloads work.
- Individual downloads work.
- Bulk ZIP downloads work.
- Image dimensions match selected presets.
- Exported files are organized by brand, campaign and platform.

---

## 11. Key Product Success Metrics

The MVP should measure:

- Time required to create the first brand kit.
- Time required to generate the first campaign.
- Percentage of successful brand extractions.
- Percentage of successful creative generations.
- Average number of regeneration attempts.
- Percentage of creatives approved without editing.
- Average creatives generated per campaign.
- Number of active brands per workspace.
- Number of completed campaign exports.

### Primary success indicator

A user should be able to go from website URL and logo to three brand-consistent social media design variations and a downloadable campaign package through one straightforward workflow.

---

## 12. Final Product Principle

Social Media Studio is not intended to be another generic AI image generator.

Its core purpose is to automate professional social media creative production while preserving the identity of each brand.

The platform must prioritize:

1. Brand consistency over random AI creativity.
2. Accurate text over AI-generated typography.
3. Reusable design systems over one-time designs.
4. Multi-brand management over single-project workflows.
5. Simple user experiences over complicated design tools.
6. Reliable exports over visually impressive but unusable previews.

**Final product definition:**

An AI-powered multi-brand social media creative studio that extracts brand identities from websites, generates marketing content and produces consistent, editable, platform-ready social media graphics through a hybrid AI and deterministic rendering engine.

---

## 13. Version 2.0 Expansion: Multi-User Gemini Vault, Interactive Studio & Social Track-and-Detect

### 13.1 Multi-User Auth & Gemini Connection Vault
- **Signed Sessions**: Password-verified user accounts backed by HMAC-SHA256 signed `HttpOnly` session cookies (`studio_session`, `studio_workspace_id`) isolating users and workspaces cleanly.
- **Encrypted Key Vault**: AES-256-GCM encrypted credential storage (`gemini_connections`) supporting **Personal User Keys** (portable private override per user) and **Workspace Shared Keys** (team-level default), plus Google AI Studio or custom Gemini-compatible endpoints.
- **Live Capability Probing**: Real-time verification of available Gemini models and capabilities (`Search Grounding`, `Vision Audit`, `Image Generation`, `Video`, `Embeddings`) alongside per-connection text and image model selectors.

### 13.2 Full Gemini Creative & Interactive Studio
- **Live Interactive Preview Stage**: 60fps HTML stage over the clean backdrop image supporting live headline edits, theme surface switching, brand accent selection, quick corner logo snaps, and **Instagram / LinkedIn** social feed mockups prior to server PNG/WebP compositing.
- **No-CTA Short Graphic Copy + Lengthy SEO Descriptions**: Graphics carry concise scannable hooks without CTA clutter, paired with multi-paragraph keyword-rich SEO captions and hashtags.
- **Gemini Multimodal Vision Audit**: Automated pre-publish inspection scoring `overallScore`, `legibilityScore`, `brandConsistencyScore`, and `visualAppealScore` alongside strengths, recommendations, and 1-click headline improvements.
- **Interactive Gemini Creative Co-Pilot**: Conversational editing inside the Studio supporting both quick actions and natural-language instructions to update copy, layout, and iteratively evolve background imagery.

### 13.3 Trend & Brand Radar (`radar`) + Social Tracker (`tracker`)
- **Trend & Brand Radar**: Uses Google Search Grounding (`googleSearch`) to detect emerging trends, seasonal hooks, competitor gaps, and website changes for tracked brands, with 1-click launch pre-filling Creative Studio.
- **Social Post Tracker & Analytics**: Tracks every generated creative through `planned -> scheduled -> published -> archived` with UTM tags, scheduled timestamps, published URLs, impressions, clicks, engagements, and a Gemini performance strategist summarizing top-performing angles and next moves.
