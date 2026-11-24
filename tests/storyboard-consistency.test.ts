import { describe, it, expect, beforeEach } from "vitest";
import { resetDbForTests } from "@/lib/db/client";
import {
  createWorkspaceWithDefaults,
  createBrand,
  createVideoProject,
  listVideoProjects,
  getVideoProjectById,
  getOrCreateStoryboard,
  saveStoryboardScenes,
  approveStoryboard,
  createReferenceEntity,
  listReferenceEntities,
  createUnifiedAsset,
  listUnifiedAssets,
  getOrCreateFlowCreditSnapshot,
  updateFlowCreditSnapshot,
} from "@/lib/db/repository";

describe("PRD Storyboard-First, Consistency Lock & Flow Companion Repository", () => {
  let wsId: string;

  beforeEach(() => {
    resetDbForTests();
    const ws = createWorkspaceWithDefaults({
      name: "Northstar Creative Studio",
      ownerId: "usr-studio-founder",
    });
    wsId = ws.id;
  });

  it("manages video projects, storyboards, and enforces approval gate state", () => {
    const brand = createBrand(wsId, {
      name: "Nordic Electric",
      domain: "nordicelectric.io",
      websiteUrl: "https://nordicelectric.io",
    });

    const project = createVideoProject(wsId, {
      brandId: brand.id,
      name: "Dusk Reveal Campaign",
      campaignObjective: "Showcase European sedan silhouette at dusk",
      productOrService: "Nordic EV Sedan",
      targetAudience: "Executive drivers",
      platform: "instagram",
      desiredDurationSeconds: 12,
      aspectRatio: "9:16",
      language: "en",
      visualStyle: "cinematic twilight",
      creativeDirection: "High-contrast architectural lighting",
      voiceoverPreference: "Subtle minimalist narration",
      callToAction: "Experience the road ahead",
      status: "draft",
    });

    expect(project.id).toBeDefined();
    expect(project.name).toBe("Dusk Reveal Campaign");
    expect(project.status).toBe("draft");

    // Retrieve or initialize storyboard
    const initialSb = getOrCreateStoryboard(wsId, project.id);
    expect(initialSb.status).toBe("draft");
    expect(initialSb.scenes.length).toBe(0);

    // Save 3 storyboard scenes
    const savedScenes = saveStoryboardScenes(wsId, initialSb.id, [
      {
        sceneNumber: 1,
        title: "Pavilion Arrival",
        durationSeconds: 4,
        narrativePurpose: "Establish setting and architecture",
        visualDescription: "Sedan emerges from twilight shadow in concrete pavilion",
        subjects: "Nordic EV Sedan",
        environment: "Brutalist concrete pavilion",
        cameraFraming: "Wide tracking",
        cameraMovement: "Slow push-in",
        lighting: "Cool dusk ambient with warm LED headlights",
        mood: "Atmospheric",
        voiceover: "Silence meets sculpted precision.",
        imagePrompt: "Photorealistic wide shot of midnight blue sedan in concrete courtyard",
        videoPrompt: "Cinematic drone tracking push-in as sedan rolls smoothly across concrete",
        status: "ready",
        version: 1,
      },
      {
        sceneNumber: 2,
        title: "Aero Lines Close-up",
        durationSeconds: 4,
        narrativePurpose: "Showcase aerodynamic curvature and finish",
        visualDescription: "Extreme close-up on hood crease reflecting soft horizon light",
        subjects: "Sedan hood and front badge",
        environment: "Architectural dusk reflection",
        cameraFraming: "Close-up",
        cameraMovement: "Lateral slide right",
        lighting: "Horizon rim light",
        mood: "Refined",
        voiceover: "Every line shaped by wind.",
        imagePrompt: "Macro detail of metallic deep blue car hood with crisp light reflections",
        videoPrompt: "Smooth gimbal slide along the metallic hood contours",
        status: "ready",
        version: 1,
      },
      {
        sceneNumber: 3,
        title: "Call to Action Reveal",
        durationSeconds: 4,
        narrativePurpose: "Hero silhouette with closing brand mark",
        visualDescription: "Rear 3/4 view as taillights pulse into dusk road",
        subjects: "Sedan rear light bar",
        environment: "Open coastal highway at twilight",
        cameraFraming: "Medium low-angle",
        cameraMovement: "Pull-back",
        lighting: "Vibrant red LED glow",
        mood: "Inspiring",
        voiceover: "The new standard is here.",
        imagePrompt: "Low angle rear view of luxury EV accelerating onto dusk highway",
        videoPrompt: "Camera follows rear taillight bar as the vehicle accelerates gently",
        status: "ready",
        version: 1,
      },
    ]);

    expect(savedScenes.length).toBe(3);
    const updatedSb = getOrCreateStoryboard(wsId, project.id);
    expect(updatedSb.totalDurationSeconds).toBe(12);
    expect(updatedSb.status).toBe("draft");

    // Approve the storyboard
    const approvedSb = approveStoryboard(wsId, initialSb.id, "usr-studio-founder");
    expect(approvedSb.status).toBe("approved");
    expect(approvedSb.approvedBy).toBe("usr-studio-founder");
    expect(approvedSb.approvedAt).toBeTruthy();

    const refreshedProject = getVideoProjectById(wsId, project.id);
    expect(refreshedProject?.status).toBe("storyboard_approved");
  });

  it("locks character and vehicle consistency references and assigns them to scenes", () => {
    const refCar = createReferenceEntity(wsId, {
      name: "Nordic Sedan Midnight Blue",
      type: "vehicle",
      userApprovedDescription: "Midnight blue metallic finish, silver aero turbine wheels, full-width red LED taillight bar",
      distinguishingAttributes: ["Metallic midnight blue finish", "No front grille (flush fascia)", "21-inch turbine wheels"],
      colorDetails: "#0b1d3a",
      continuityRules: "Never alter paint color or wheel spoke design across any scene.",
      isLocked: true,
      version: 1,
    });

    expect(refCar.id).toBeDefined();
    expect(refCar.isLocked).toBe(true);

    const list = listReferenceEntities(wsId);
    expect(list.length).toBe(1);
    expect(list[0].name).toBe("Nordic Sedan Midnight Blue");
    expect(list[0].distinguishingAttributes.length).toBe(3);
  });

  it("tracks unified assets and manual Flow credit snapshots", () => {
    const snapshot = getOrCreateFlowCreditSnapshot(wsId);
    expect(snapshot.planLabel).toBe("Google AI Pro");
    expect(snapshot.userEnteredBalance).toBe(1000);

    const updatedSnapshot = updateFlowCreditSnapshot(wsId, {
      userEnteredBalance: 920,
      notes: "Generated 8 scenes via Google Flow manually",
    });
    expect(updatedSnapshot.userEnteredBalance).toBe(920);
    expect(updatedSnapshot.notes).toContain("8 scenes");

    const asset = createUnifiedAsset(wsId, {
      assetType: "video",
      provider: "google_flow",
      modelId: "google-veo-flow",
      prompt: "Cinematic drone tracking push-in as sedan rolls smoothly",
      storagePath: "/storage/videos/scene-1.mp4",
      mimeType: "video/mp4",
      fileSizeBytes: 4200000,
      durationSeconds: 4,
      approvalStatus: "approved",
      version: 1,
    });

    expect(asset.id).toBeDefined();
    expect(asset.provider).toBe("google_flow");

    const assets = listUnifiedAssets(wsId, { provider: "google_flow" });
    expect(assets.length).toBe(1);
    expect(assets[0].fileSizeBytes).toBe(4200000);
  });
});
