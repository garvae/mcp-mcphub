// SPDX-License-Identifier: Apache-2.0

export type CompatibilityStatus = 'best-effort' | 'smoke-tested' | 'verified';

export type UpstreamCompatibilityTarget = {
  imageTag: string;
  label: string;
  notes: string;
  routeSnapshotVersion?: string;
  status: CompatibilityStatus;
};

export const UPSTREAM_COMPATIBILITY_REPOSITORY = 'samanhappy/mcphub';
export const ROUTE_SNAPSHOT_BASELINE_VERSION = '1.0.15';
export const PINNED_RELEASE_TARGET_VERSION = '1.0.20';
export const MINIMUM_BEST_EFFORT_VERSION = '1.0.15';
export const PINNED_RELEASE_TARGET_HAS_ROUTE_SNAPSHOT = false;
export const AUTOMATED_COMPATIBILITY_IMAGE_TAGS = ["1.0.15","1.0.20","latest"] as const;
export const PINNED_RELEASE_TARGET_NOTE = 'Pinned release target refreshed by weekly automation; runtime compatibility is smoke-tested even when no dedicated route snapshot is committed yet.';
export const COMPATIBILITY_NOTES_SUMMARY = 'The weekly pinned release target is `1.0.20`; if no dedicated route snapshot is committed yet, container smoke tests still cover runtime compatibility.';

export const UPSTREAM_COMPATIBILITY_TARGETS: readonly UpstreamCompatibilityTarget[] = [
  {
    imageTag: '1.0.15',
    label: '1.0.15',
    notes: 'Current pinned route snapshot and compatibility baseline.',
    routeSnapshotVersion: '1.0.15',
    status: 'verified',
  },
  {
    imageTag: '1.0.20',
    label: '1.0.20',
    notes: PINNED_RELEASE_TARGET_NOTE,
    status: 'smoke-tested',
  },
  {
    imageTag: 'latest',
    label: 'latest Docker tag',
    notes: 'Tracks the upstream latest container tag in scheduled CI.',
    status: 'smoke-tested',
  },
  {
    imageTag: '<1.0.15',
    label: '<1.0.15',
    notes: 'Not covered by the automated compatibility matrix.',
    status: 'best-effort',
  },
] as const;

export function getAutomatedCompatibilityTargets(selectedImageTag?: string): UpstreamCompatibilityTarget[] {
  const automatedTargets = UPSTREAM_COMPATIBILITY_TARGETS.filter((target) => AUTOMATED_COMPATIBILITY_IMAGE_TAGS.includes(target.imageTag as (typeof AUTOMATED_COMPATIBILITY_IMAGE_TAGS)[number]));

  if (selectedImageTag === undefined || selectedImageTag.length === 0) {
    return [...automatedTargets];
  }

  const selectedTarget = automatedTargets.find((target) => target.imageTag === selectedImageTag);
  if (selectedTarget === undefined) {
    throw new Error(`Unknown MCPHub compatibility target "${selectedImageTag}".`);
  }

  return [selectedTarget];
}
