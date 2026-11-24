# Social Media Studio --- Image & Video Creation PRD

**Document type:** Product Requirements Document\
**Product:** Social Media Studio\
**Scope:** AI image creation, storyboard-first video production, Google
Flow companion, Gemini/Veo API generation, asset management\
**Status:** Implementation-ready product specification\
**Primary implementation environment:** Existing Antigravity project,
Next.js, Vercel, existing database/authentication where available

------------------------------------------------------------------------

## 1. Executive Summary

Social Media Studio will provide a unified workspace for creating,
reviewing, managing, and exporting AI-generated images and videos for
social media campaigns.

The product will support two distinct generation routes:

1.  **Google Flow Companion:** Helps a user prepare prompts and
    reference materials, open Google Flow, generate content using their
    own Google AI Pro subscription, and import the resulting files back
    into the relevant project.
2.  **Direct API Generation:** Uses officially supported Gemini
    image-generation and Veo video-generation APIs with user-provided
    API credentials or an explicitly configured server-side provider
    account.

The application must clearly distinguish Google Flow subscription
credits from Gemini API or Google Cloud billing. It must not claim that
Flow credits can be consumed by the application through an API unless
Google introduces and documents an official integration that permits
this.

Video production will be **storyboard-first**. Users create and approve
a script, storyboard, and scene reference images before generating video
clips. Approved scenes can then be generated individually through the
Google Flow Companion workflow or supported direct API integrations.

A project-level **Character & Product Consistency Lock** will maintain
approved visual references and continuity instructions across scenes.

The system will unify all imported and API-generated assets in a
project-based media library.

------------------------------------------------------------------------

## 2. Product Goals

### 2.1 Primary goals

-   Provide one workspace for image and video creation.
-   Make the user's existing Google Flow subscription useful within the
    Social Media Studio workflow.
-   Avoid unnecessary API spending when the user intends to use Flow.
-   Support direct, automated generation through official APIs where
    configured.
-   Make video production controllable through an editable storyboard.
-   Improve visual consistency across scenes, especially for recurring
    people, vehicles, products, packaging, clothing, and environments.
-   Allow users to revise individual images or scenes without rebuilding
    an entire project.
-   Keep prompts, references, versions, clips, and final exports
    organized by workspace and project.
-   Provide transparent provider attribution and API usage estimates.

### 2.2 Non-goals

-   Recreating the Google Flow interface.
-   Claiming direct access to a user's private Flow account or credit
    balance.
-   Spending Google Flow credits from the app through undocumented
    endpoints.
-   Automating private Flow browser controls, scraping authenticated
    pages, or using stored Google session cookies.
-   Guaranteeing identical characters or products across generative
    models. The product can provide references and consistency
    instructions, but model outputs remain probabilistic.
-   Replacing a full professional non-linear video editor in the initial
    release.

------------------------------------------------------------------------

## 3. Users and Core Use Cases

### 3.1 Target users

-   Social media managers.
-   Content creators.
-   Marketing teams.
-   Small businesses and agencies.
-   Designers and creative professionals.
-   Workspace teams producing recurring branded content.

### 3.2 Core use cases

1.  Create a campaign image from a text prompt.
2.  Create image variations from a reference image.
3.  Prepare a prompt and reference for generation in Google Flow.
4.  Generate a video concept, script, and storyboard from a campaign
    brief.
5.  Edit and approve each storyboard scene.
6.  Generate reference images for each scene.
7.  Lock character, product, and visual references for continuity.
8.  Generate approved scenes through Google Flow or an official video
    API.
9.  Import Flow-generated scene clips.
10. Review and replace individual clips.
11. Assemble approved clips into a final social video.
12. Reopen a project and continue from its last saved stage.

------------------------------------------------------------------------

## 4. Product Principles

-   **Storyboard first:** No video generation before explicit storyboard
    approval.
-   **User control:** The user can edit every prompt and scene before
    generation.
-   **Provider transparency:** Clearly show whether an asset was
    generated through Flow, Gemini, or Veo API.
-   **No silent paid fallback:** A failed Flow workflow must never
    silently trigger paid API generation.
-   **Preserve work:** Changes to one scene must not overwrite approved
    work in other scenes.
-   **Reference-led consistency:** Maintain reusable visual references
    and continuity notes.
-   **Clarity over cleverness:** Keep workflows scannable and controls
    obvious.
-   **Responsive by design:** Support desktop creative workflows and a
    usable mobile experience.
-   **Secure by default:** Protect API credentials, project assets, and
    workspace data.

------------------------------------------------------------------------

## 5. Information Architecture

Add the following product areas to the existing application, reusing its
current navigation and design system:

-   **AI Creation Studio**
    -   Image Creator
    -   Video Creator
    -   Prompt Library (if not already present)
-   **Video Projects**
    -   Brief
    -   Script
    -   Storyboard
    -   Visual References
    -   Scene Generation
    -   Timeline & Assembly
    -   Exports
-   **Asset Library**
    -   All Assets
    -   Images
    -   Videos
    -   Google Flow Imports
    -   API-Generated Assets
-   **Provider Settings**
    -   Google Flow Companion
    -   Gemini API
    -   Veo API
-   **Usage**
    -   API usage and estimated costs
    -   Flow credit planner (manual estimates only)

Do not create duplicate navigation if equivalent modules already exist.
Extend existing routes and components.

------------------------------------------------------------------------

## 6. Provider Model and Integration Boundaries

### 6.1 Provider types

  -----------------------------------------------------------------------
  Provider          Purpose           How generation    Billing/credits
                                      happens           
  ----------------- ----------------- ----------------- -----------------
  Google Flow       Image and video   External Flow     User's Google
                    generation        workflow; user    Flow subscription
                    through the       generates in Flow credits
                    user's Flow       and imports       
                    subscription      output            

  Gemini Image API  Programmatic      Official Gemini   Separate API
                    image generation  API               billing/quota

  Veo API           Programmatic      Official Veo API  Separate API
                    video generation  or supported      billing/quota
                                      Google Cloud      
                                      route             
  -----------------------------------------------------------------------

Provider model IDs, supported inputs, aspect ratios, durations, output
formats, and pricing must be configurable and checked against current
official documentation. Do not assume a model or parameter remains
available indefinitely.

### 6.2 Google Flow Companion

The application must provide an integrated companion workflow without
claiming that it directly invokes Flow generation.

Flow workflow:

1.  User selects Google Flow as the provider.
2.  App prepares the prompt and relevant project/scene instructions.
3.  User explicitly chooses **Copy Prompt** and/or **Open Google Flow**.
4.  App opens the official Flow product in a new tab.
5.  User generates the image or video within Flow using their Google
    account.
6.  User returns to Social Media Studio.
7.  User imports the output through file upload or drag-and-drop.
8.  App validates, stores, and associates the asset with the selected
    project, scene, or image task.
9.  Asset provider is recorded as `google_flow`.

Official Flow URL should be configurable, with the current official
destination used by default: `https://labs.google/fx/tools/flow`.

The application must not: - Use undocumented Flow endpoints. - Scrape
Flow pages for credit balances or generation results. - Store or reuse
Google session cookies. - Claim that opening Flow starts a generation. -
Claim that Flow credits were deducted by the app. - Automatically switch
to paid API generation when the user encounters a Flow limitation.

### 6.3 Google Flow credit planner

Provide a planner for the user's subscription, not a connected account
balance.

Requirements: - Subscription label, initially configurable as Google AI
Pro. - Monthly credit allocation setting. - Daily credit allocation
setting, if applicable to the user's current plan and region. -
Billing-cycle reset date. - Manually entered available balance. -
Optional manual usage entries. - Configurable credit cost per Flow model
and operation. - Estimated remaining generations based on user-entered
balance and configured rates. - Last-updated timestamp. - Clear label:
**Manually maintained estimate --- not verified by Google**. - Link to
the official Flow product/credit information.

Do not hardcode plan allocations, model costs, rollover rules, or
regional entitlements as permanent truths. The user must be able to
update them, and the interface must advise checking the current Flow
interface for authoritative credit costs and balances.

### 6.4 Direct API generation

-   Use official, documented Gemini and Veo APIs only.
-   Support user-owned API credentials if this is already part of the
    product's architecture.
-   Keep credentials server-side and encrypted at rest.
-   Do not expose keys in client bundles, browser storage, URLs, logs,
    or error messages.
-   Use asynchronous generation jobs for long-running video operations.
-   Store provider operation IDs and poll or otherwise check status
    using supported API mechanisms.
-   Validate model capabilities before showing generation options.
-   Show an estimated cost or usage warning when reliable pricing
    information is available.
-   Require explicit user confirmation before a paid generation when
    cost may be incurred.

------------------------------------------------------------------------

## 7. Image Creation Requirements

### 7.1 Image creation modes

Support, subject to selected model capabilities:

-   Text-to-image.
-   Reference-image-guided generation.
-   Image variations.
-   Image editing or transformation where supported.
-   Campaign/brand-based image generation.
-   Image generation for storyboard scene references.

### 7.2 Image creation inputs

-   Project and campaign.
-   Prompt.
-   Optional negative prompt, if supported.
-   Reference images.
-   Output aspect ratio.
-   Output size or resolution, where supported.
-   Selected provider.
-   Selected model.
-   Number of variations, where supported.
-   Brand kit or visual style reference.
-   Optional subject/product consistency reference.

### 7.3 Aspect ratios

Offer common presets where supported by the selected provider:

-   1:1
-   4:5
-   3:4
-   9:16
-   16:9
-   3:2

Do not show unsupported ratios for a selected model. Provide a clear
explanation when a provider requires a different output format.

### 7.4 Image workflow

1.  Select Image Creator.
2.  Select a project or create a new one.
3.  Choose provider.
4.  Enter or enhance prompt.
5.  Upload reference images if needed.
6.  Configure supported settings.
7.  Review provider and any estimated API cost.
8.  Generate through API or prepare/open Flow.
9.  Preview the output.
10. Save, rename, regenerate, or create a variation.
11. Store the asset and prompt history in the project library.

### 7.5 Image acceptance criteria

-   User can generate an image through a configured official API.
-   User can prepare a prompt for Google Flow and import the resulting
    image.
-   Imported and API-generated images are clearly attributed.
-   Image metadata and prompt are saved.
-   User can regenerate or replace one image without changing unrelated
    assets.
-   User can reuse an image as a reference in another task.
-   Unsupported model options are hidden or disabled with an
    explanation.

------------------------------------------------------------------------

## 8. Video Creation: Storyboard-First Workflow

### 8.1 Mandatory workflow

The video creation workflow must follow this order:

1.  Campaign brief.
2.  Concept and creative direction.
3.  Script and narration.
4.  Storyboard generation.
5.  Storyboard editing.
6.  Character & Product Consistency Lock setup.
7.  Scene reference image generation.
8.  Storyboard and reference approval.
9.  Scene-by-scene video generation.
10. Clip review and approval.
11. Timeline assembly.
12. Final export.

**No video generation action may be available until the storyboard has
been explicitly approved.**

A user may save drafts and return later. Approval must be recorded with
a timestamp and storyboard version.

### 8.2 Video brief

Collect:

-   Campaign/project name.
-   Campaign objective.
-   Product or service.
-   Target audience.
-   Platform.
-   Desired duration.
-   Aspect ratio.
-   Language.
-   Creative direction.
-   Visual style.
-   Brand guidelines.
-   Voiceover preference.
-   Dialogue preference.
-   Music preference.
-   Call to action.
-   Required disclaimers or exact text.
-   Reference media.

Use conversational, concise labels and sensible defaults. Do not force
optional fields.

### 8.3 Concept and script generation

Use the configured text-generation model to prepare:

-   Creative concept.
-   Core message.
-   Opening hook.
-   Narrative structure.
-   Script.
-   Scene breakdown.
-   Voiceover/dialogue.
-   On-screen text.
-   Closing CTA.

Script length and scene duration should be planned against the requested
total duration. Show the calculated total and warn if scene durations do
not match the target.

Users must be able to edit the script before generating the storyboard.

### 8.4 Storyboard scene schema

Each scene must contain:

  Field                Description
  -------------------- ---------------------------------------------
  Scene ID             Stable unique identifier
  Scene number         Display order
  Title                Short scene name
  Duration             Planned duration in seconds
  Narrative purpose    Why the scene exists
  Visual description   What appears and happens
  Subjects             People, products, vehicles, objects
  Environment          Location and background
  Camera framing       Wide, medium, close-up, etc.
  Camera movement      Static, pan, tilt, tracking, push-in, etc.
  Lighting             Lighting direction and quality
  Mood                 Emotional tone
  Voiceover            Narration for the scene
  Dialogue             Spoken words, if any
  On-screen text       Exact text to appear
  Image prompt         Reference image prompt
  Video prompt         Motion-focused generation prompt
  Negative prompt      Exclusions, if supported
  Transition           Transition into the next scene
  Reference assets     Approved visual references
  Scene status         Draft, ready, approved, generated, rejected
  Version              Scene revision number

### 8.5 Storyboard editor

Provide a visual editor with:

-   Scene cards and thumbnails.
-   Drag-and-drop ordering.
-   Add scene.
-   Duplicate scene.
-   Delete scene.
-   Edit all scene fields.
-   Change duration.
-   Reorder scenes.
-   Regenerate one scene's text.
-   Regenerate one scene's image prompt.
-   Regenerate one scene's reference image.
-   Edit voiceover and on-screen text.
-   Preview scene details.
-   Approve or reject individual scenes.
-   Approve the complete storyboard.
-   Display total duration and scene count.
-   Autosave or explicit save with visible save state.

Stable scene IDs must be preserved when scenes are reordered. Editing
one scene must not overwrite the content or approval state of unrelated
scenes.

### 8.6 Storyboard approval gate

Before video generation: - Every scene intended for generation must be
complete. - The storyboard must have a saved version. - The user must
explicitly approve the storyboard. - The application must record
approver, timestamp, and approved version. - Any material edit to an
approved scene must mark that scene as changed and require reapproval. -
A material change to the overall scene order or script should trigger a
storyboard review. - The application must never silently generate video
from an unapproved or outdated storyboard.

------------------------------------------------------------------------

## 9. Character & Product Consistency Lock

### 9.1 Purpose

Provide a project-level reference system to improve visual continuity
across storyboard scenes and generated clips.

This feature is especially important for: - Recurring people or
characters. - Vehicles. - Products and packaging. - Logos and brand
marks. - Clothing and accessories. - Locations and environments. -
Recurring props.

The system must communicate that consistency controls improve guidance
but cannot guarantee pixel-identical results from generative models.

### 9.2 Reference library

Allow users to create named reference entities:

-   Character reference.
-   Product reference.
-   Vehicle reference.
-   Brand/logo reference.
-   Wardrobe reference.
-   Location/environment reference.
-   Prop reference.
-   Other custom reference.

Each reference entity should include: - Reference ID. - Name. - Type. -
One or more reference images. - User-approved description. -
Distinguishing visual attributes. - Color/material details. - Relevant
continuity instructions. - Optional exclusions. - Version and approval
state.

Users must explicitly approve the description generated from an image
before it becomes a locked project reference. Do not infer sensitive
personal attributes from reference photos.

### 9.3 Consistency profiles

Allow the user to create a profile such as:

**Main Character** - Approved reference images. - Hair/appearance
description supplied or approved by user. - Clothing and accessories. -
Distinctive non-sensitive visual details. - Continuity rules.

**Featured Product** - Approved product images. - Product shape and
color. - Packaging and visible markings. - Logo placement. - Materials
and finish. - Details that must not change.

**Environment** - Location reference. - Architecture and background. -
Time of day. - Lighting style. - Color palette.

### 9.4 Scene-to-reference assignment

For each storyboard scene, users can: - Attach one or more project
references. - Mark references as required or optional. - Exclude
references that do not belong in the scene. - Add scene-specific
continuity notes.

When preparing an image or video prompt, the system must: 1. Retrieve
the approved references assigned to that scene. 2. Include relevant
descriptions and continuity instructions. 3. Include reference images
when the selected provider supports them. 4. Avoid attaching unrelated
project references. 5. Preserve exact user-provided text, product facts,
and logo requirements. 6. Show the references that will be sent to the
provider before generation.

### 9.5 Consistency validation

Before generation, show a checklist:

-   Character reference attached, if required.
-   Product reference attached, if required.
-   Brand/logo reference attached, if required.
-   Scene description does not contradict locked attributes.
-   Required visual details are present in the prompt.
-   Reference image is compatible with the selected provider.

Warnings must be advisory unless a required reference is missing. Users
may resolve the warning or explicitly proceed where appropriate.

### 9.6 Regeneration behavior

-   Regenerating a scene must reuse its approved reference assignments
    by default.
-   Users can change references before regenerating.
-   A scene regeneration must not modify project-level reference
    entities.
-   Updating a project-level reference must create a new version and
    warn that affected scenes may need review.
-   Previously generated assets must remain available as versions unless
    the user deletes them.

### 9.7 Consistency acceptance criteria

-   User can create and approve named reference entities.
-   User can attach references to individual scenes.
-   Prompts are assembled from the correct scene references.
-   The user can inspect the references before generation.
-   Regenerating one scene does not change other scenes.
-   Reference updates are versioned.
-   The interface does not promise perfect consistency.

------------------------------------------------------------------------

## 10. Scene Reference Image Generation

Before video generation, create or import a visual reference image for
every scene that requires one.

Requirements: - Generate through Gemini image API or prepare the task
for Google Flow. - Support multiple candidate images where the provider
allows it. - Attach approved character, product, vehicle, and
environment references. - Allow users to select one image as the
approved scene reference. - Allow individual scene reference
regeneration. - Preserve previous candidates. - Store reference images
separately from final video clips. - Display reference approval status.

Users must be able to approve a storyboard without generating reference
images only when the scene is intentionally text-only or the chosen
workflow does not require an image reference. Make this choice explicit.

------------------------------------------------------------------------

## 11. Scene-by-Scene Video Generation

### 11.1 Generation preparation

For each approved scene, prepare:

-   Scene-specific video prompt.
-   Scene duration.
-   Aspect ratio.
-   Camera movement.
-   Subject/action instructions.
-   Visual style.
-   Continuity instructions.
-   Approved reference images.
-   Negative prompt, where supported.
-   Provider and model.
-   Estimated API cost, where available.

### 11.2 Google Flow scene workflow

For each scene: 1. User selects Google Flow. 2. App prepares the
scene-specific prompt and reference package. 3. User copies the prompt
and opens Flow. 4. User generates the clip in Flow. 5. User imports the
clip into the corresponding scene. 6. App validates the file and
associates it with the scene. 7. User previews and approves or rejects
the clip.

Provide a scene checklist with statuses: - Not started. - Prepared for
Flow. - Awaiting import. - Imported. - In review. - Approved. -
Rejected.

Allow the user to prepare multiple scene prompts, but do not imply that
the app can submit multiple Flow jobs automatically.

### 11.3 Veo API scene workflow

For each approved scene: - Submit a separate generation job through the
official API. - Store provider operation ID. - Track processing status
asynchronously. - Retrieve the completed output through supported
mechanisms. - Store the clip in cloud storage. - Associate it with the
correct scene and generation job. - Allow preview and approval. - Allow
regeneration of an individual scene.

Do not keep a Vercel request open while waiting for video generation.
Use durable job processing, a queue/worker, or a suitable asynchronous
architecture.

### 11.4 Scene regeneration

-   Regenerate only the selected scene.
-   Preserve its storyboard description and approved references by
    default.
-   Save each generated result as a new version.
-   Never overwrite an approved clip without explicit user confirmation.
-   Do not automatically regenerate all other scenes.

------------------------------------------------------------------------

## 12. Video Timeline and Assembly

### 12.1 Initial assembly features

After all required clips are approved, provide a timeline-based assembly
workspace.

Support: - Scene ordering. - Clip trimming at start and end. - Basic
transitions. - Voiceover track. - Background music track. -
Subtitle/caption track. - Logo/brand overlay. - Intro and outro. -
Preview. - Final export.

### 12.2 Assembly rules

-   Use approved clips by default.
-   Display missing or unapproved scenes.
-   Show total assembled duration.
-   Warn if the output duration differs from the campaign target.
-   Preserve original clips.
-   Save each assembled export as a new version.
-   Provide a clear export progress state.

Use FFmpeg or a suitable video-processing service for assembly. Confirm
that the chosen processing environment has adequate execution time,
memory, and storage; do not assume long FFmpeg jobs are suitable for
standard Vercel request execution.

### 12.3 Export formats

Offer common presets, subject to source and processing capabilities:

-   Vertical social: 9:16.
-   Square: 1:1.
-   Portrait feed: 4:5.
-   Landscape: 16:9.

Allow output resolution and frame-rate settings only when supported by
the selected processing pipeline.

------------------------------------------------------------------------

## 13. Asset Library and Version Management

### 13.1 Unified asset library

Store and display: - Generated images. - Imported Flow images. -
Storyboard reference images. - Generated video clips. - Imported Flow
video clips. - Voiceover files. - Music files. - Final assembled
videos. - Thumbnails and previews.

### 13.2 Filters

-   All assets.
-   Images.
-   Videos.
-   Audio.
-   Google Flow.
-   Gemini API.
-   Veo API.
-   Project.
-   Scene.
-   Date.
-   Status.

### 13.3 Asset actions

-   Preview.
-   Download.
-   Rename.
-   Delete.
-   Reuse as reference.
-   Assign to a project.
-   Assign to a storyboard scene.
-   View prompt and provider details.
-   View version history.

### 13.4 Asset metadata

Each asset should include, as applicable:

-   Asset ID.
-   Workspace ID.
-   Project ID.
-   Scene ID.
-   Asset type.
-   Provider.
-   Model.
-   Original prompt.
-   Negative prompt.
-   Original filename.
-   Storage key/URL.
-   Thumbnail key/URL.
-   MIME type.
-   File size.
-   Width and height.
-   Duration.
-   Creation date.
-   Generation job ID.
-   Version number.
-   Approval status.
-   User who imported or generated it.

Do not expose permanent private storage URLs if the storage provider
supports secure signed URLs.

------------------------------------------------------------------------

## 14. Data Model

Audit the existing database first. Reuse existing tables and
relationships wherever possible. The following is a logical model, not a
mandate to duplicate existing schema.

### 14.1 Suggested entities

  -----------------------------------------------------------------------
  Entity                              Purpose
  ----------------------------------- -----------------------------------
  workspaces                          Workspace ownership and isolation

  provider_connections                Encrypted provider credentials and
                                      settings

  projects                            Campaign and creative project
                                      records

  image_tasks                         Image generation request details

  video_projects                      Video brief and production settings

  scripts                             Script versions

  storyboards                         Storyboard versions and approval
                                      state

  storyboard_scenes                   Individual scene data and ordering

  reference_entities                  Character, product, vehicle, brand,
                                      and environment references

  reference_versions                  Versioned reference images and
                                      descriptions

  scene_reference_assignments         Mapping of references to scenes

  generation_jobs                     API generation jobs and provider
                                      operation IDs

  assets                              Unified media metadata

  asset_versions                      Version history

  scene_clip_assignments              Mapping of generated clips to
                                      scenes

  exports                             Final assembled video outputs

  usage_logs                          API usage and estimated costs

  flow_credit_snapshots               User-entered Flow balance estimates
  -----------------------------------------------------------------------

### 14.2 Workspace isolation

-   Every user-owned record must be scoped to the correct workspace.
-   Enforce access controls on all server operations.
-   Verify that an asset, reference, scene, or project belongs to the
    requesting workspace before access or mutation.
-   Do not trust workspace IDs supplied by the client without
    authorization checks.

### 14.3 Versioning

Version: - Scripts. - Storyboards. - Scenes. - Reference entities. -
Generated images. - Generated clips. - Final exports.

Preserve prior versions unless the user explicitly deletes them.

------------------------------------------------------------------------

## 15. Suggested API and Service Boundaries

Adapt route naming to the existing application conventions.

Potential server-side service boundaries:

### Image

-   Create image task.
-   Validate provider/model capabilities.
-   Submit image generation.
-   Retrieve image task status.
-   Save generated image.
-   Create image variation.

### Video

-   Create video project.
-   Generate script.
-   Generate storyboard.
-   Update storyboard scene.
-   Approve storyboard version.
-   Create/update reference entity.
-   Assign references to scene.
-   Generate scene reference image.
-   Approve scene reference.
-   Submit video scene generation.
-   Retrieve generation status.
-   Import Flow clip.
-   Approve/reject clip.
-   Assemble timeline.
-   Export final video.

### Provider

-   Validate API connection.
-   Retrieve supported model capabilities where officially supported.
-   Estimate API costs from maintained pricing configuration.
-   Record provider usage.

### Assets

-   Upload asset.
-   Validate MIME type and file size.
-   Create thumbnail.
-   Associate asset with project or scene.
-   Create asset version.
-   Delete asset and associated storage object under authorized rules.

These are logical service boundaries. Do not create unnecessary
endpoints if existing services already provide the same functionality.

------------------------------------------------------------------------

## 16. Security, Privacy, and Reliability

### 16.1 API credentials

-   Encrypt credentials at rest.
-   Decrypt only server-side when needed.
-   Never return secrets to the client.
-   Never log raw credentials.
-   Support rotation and deletion.
-   Separate credentials by workspace/user ownership as appropriate.

### 16.2 File uploads

-   Validate MIME type and file extension.
-   Enforce configurable file size and duration limits.
-   Reject unsupported or malformed files.
-   Use signed upload/download URLs where supported.
-   Scan uploads where the infrastructure provides a suitable scanning
    capability.
-   Prevent path traversal and unsafe filenames.
-   Ensure imported assets cannot be accessed across workspaces.

### 16.3 Jobs and retries

-   Use durable job state.
-   Make job submission idempotent where practical.
-   Distinguish queued, processing, completed, failed, cancelled, and
    timed-out states.
-   Retry transient errors only within configured limits.
-   Do not retry errors that would create duplicate billable generation
    without an explicit policy.
-   Show useful error messages without leaking provider secrets.

### 16.4 Cost controls

-   Display provider before submission.
-   Show estimated API costs when reliable.
-   Require confirmation for paid API generation according to workspace
    settings.
-   Never silently switch providers.
-   Keep Flow credit estimates separate from API usage.
-   Do not claim Flow credit deduction or balance verification by the
    app.

------------------------------------------------------------------------

## 17. UI/UX Requirements

### 17.1 Visual direction

-   Premium, professional creative SaaS.
-   Distinctive visual hierarchy.
-   Clear and calm interface.
-   Generous negative space.
-   Avoid generic AI dashboard patterns.
-   Reuse the existing product's visual system.
-   Maintain a consistent experience across image and video workflows.

### 17.2 Accessibility and responsive design

-   Minimum desktop text size: 16px.
-   Minimum mobile text size: 14px.
-   Keyboard-accessible controls.
-   Visible focus states.
-   Clear status labels.
-   Adequate contrast.
-   Mobile-friendly scene editing and upload.
-   On mobile, present storyboard scenes as an easy-to-navigate vertical
    list or focused scene editor rather than forcing a dense desktop
    timeline.

### 17.3 Required states

Every major workflow must include: - Empty state. - Loading state. -
Processing state. - Success state. - Failure state. - Retry or recovery
action. - Saved/unsaved state. - Permission-denied state.

Do not display fake progress percentages unless actual progress data is
available. Use honest states such as "Processing" or "Waiting for
provider."

------------------------------------------------------------------------

## 18. Analytics and Usage Tracking

Track: - Image generation requests. - Successful and failed API
generations. - Video scene generation jobs. - Imported Flow assets. -
Asset imports and storage volume. - Storyboard creation and approval. -
Scene regeneration count. - Export count. - Estimated API costs. -
Manually recorded Flow usage estimates.

Do not mix subscription credits with API currency costs in a single
total.

------------------------------------------------------------------------

## 19. Acceptance Criteria

### Image creation

-   User can create an image through an enabled official API.
-   User can prepare an image prompt for Flow.
-   User can import Flow-generated images.
-   Assets are saved to the correct project.
-   Provider attribution and prompt history are retained.

### Video storyboard

-   User can create a video brief.
-   AI can prepare a concept and script.
-   AI can generate an editable storyboard.
-   User can add, delete, duplicate, edit, and reorder scenes.
-   Total duration is calculated correctly.
-   User must explicitly approve the storyboard before video generation.

### Consistency Lock

-   User can create named character/product/brand/environment
    references.
-   User can approve reference descriptions.
-   User can assign references to scenes.
-   Prompt preparation uses only the relevant assigned references.
-   Scene regeneration preserves reference assignments by default.
-   Reference changes are versioned.
-   The UI does not promise perfect model consistency.

### Scene generation

-   User can prepare each approved scene for Flow.
-   User can open Flow and import its generated clip.
-   User can generate a scene through an enabled official Veo API.
-   Each clip is associated with its correct scene.
-   User can review, approve, reject, or regenerate one clip.
-   Other scenes remain unchanged.

### Assembly

-   User can assemble approved clips.
-   User can add supported audio, captions, transitions, and branding.
-   User can preview and export a final video.
-   Export is stored persistently.
-   Prior exports remain available as versions.

### Security and cost

-   API keys are never exposed to the browser.
-   Workspace isolation is enforced.
-   Flow credits are never represented as API credits.
-   API generation costs are tracked separately.
-   Paid API generation is never triggered silently.

------------------------------------------------------------------------

## 20. Implementation Phases

### Phase 0 --- Codebase audit and technical design

-   Inspect existing application.
-   Map existing authentication, workspaces, database, storage, API key
    handling, and design system.
-   Identify reusable components and schema.
-   Document gaps and proposed migrations.
-   Do not modify working modules unnecessarily.

### Phase 1 --- Shared provider and asset foundation

-   Provider selection.
-   Secure credential management.
-   Unified asset schema.
-   Cloud storage integration.
-   Generation job foundation.
-   Usage tracking.

### Phase 2 --- Image Creation Studio

-   Gemini image generation.
-   Flow image prompt preparation.
-   Flow image import.
-   Image preview and versioning.

### Phase 3 --- Video brief, script, and storyboard

-   Video project creation.
-   Brief form.
-   Script generation.
-   Storyboard generation.
-   Storyboard editor.
-   Duration calculation.
-   Approval gate.

### Phase 4 --- Character & Product Consistency Lock

-   Reference library.
-   Reference descriptions and approvals.
-   Scene-reference assignments.
-   Prompt assembly.
-   Versioning and validation.

### Phase 5 --- Scene reference images

-   Generate or import scene reference images.
-   Review and approve references.
-   Maintain scene-specific versions.

### Phase 6 --- Video generation

-   Flow scene preparation and import.
-   Veo API scene generation.
-   Asynchronous job processing.
-   Scene review and regeneration.

### Phase 7 --- Timeline and export

-   Clip ordering and trimming.
-   Audio and captions.
-   Branding and transitions.
-   Final rendering and persistent export storage.

### Phase 8 --- QA and deployment

-   End-to-end testing.
-   Security testing.
-   Workspace permission testing.
-   Mobile and desktop QA.
-   Vercel deployment validation.
-   Environment variable and operational documentation.

------------------------------------------------------------------------

## 21. Antigravity Development Instructions

Antigravity must:

1.  Begin with a full codebase audit.
2.  Report the current architecture and reusable components before
    modifying files.
3.  Preserve existing features, routes, data, and visual conventions.
4.  Avoid duplicating existing database entities or services.
5.  Propose schema migrations before applying them.
6.  Implement in the phases listed above.
7.  Verify each phase before continuing.
8.  Use official, documented Google APIs only for direct API generation.
9.  Keep Google Flow as an external user-operated workflow unless Google
    officially documents a supported third-party generation API.
10. Never use private endpoints, scraping, or Google session automation.
11. Never fabricate generation results, job statuses, provider balances,
    or progress.
12. Never silently switch from Flow to a paid API.
13. Keep long-running generation and rendering outside ordinary
    short-lived request handlers.
14. Use persistent cloud storage for media.
15. Provide setup, migration, environment, testing, and deployment
    documentation.
16. Report incomplete features honestly instead of marking them
    complete.

### Required initial audit report

Before coding, provide:

-   Existing architecture summary.
-   Existing routes and components to reuse.
-   Existing database and storage capabilities.
-   Existing Gemini integration status.
-   Required schema changes.
-   Required environment variables.
-   Recommended job-processing and rendering approach.
-   Phased implementation plan.
-   Risks, limitations, and external service dependencies.

**Do not begin destructive changes or rebuild the application.**

------------------------------------------------------------------------

## 22. Product Success Definition

The feature set is successful when a user can:

1.  Create an image using an official API or prepare and import an image
    from Google Flow.
2.  Start a video project with a clear creative brief.
3.  Generate and edit a complete storyboard.
4.  Establish approved character, product, and brand references.
5.  Generate and approve scene reference images.
6.  Approve the storyboard before spending video-generation credits or
    API budget.
7.  Generate or import individual video scenes.
8.  Regenerate only the scenes that need improvement.
9.  Assemble approved clips into a finished social media video.
10. Find all prompts, references, assets, versions, and exports in the
    correct project.

The final experience should feel like a cohesive professional creative
production studio, not a collection of disconnected AI generation tools.
