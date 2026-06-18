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
export const PINNED_RELEASE_TARGET_VERSION = '1.0.16';
export const MINIMUM_BEST_EFFORT_VERSION = '1.0.15';
export const PINNED_RELEASE_TARGET_HAS_ROUTE_SNAPSHOT = true;
export const AUTOMATED_COMPATIBILITY_IMAGE_TAGS = ["1.0.15","1.0.16","latest"] as const;
export const PINNED_RELEASE_TARGET_NOTE = 'Pinned release target with a committed route snapshot for 1.0.16.';
export const COMPATIBILITY_NOTES_SUMMARY = 'The `1.0.16` route snapshot is committed alongside the current baseline.';

export const UPSTREAM_COMPATIBILITY_TARGETS: readonly UpstreamCompatibilityTarget[] = [
  {
    imageTag: '1.0.15',
    label: '1.0.15',
    notes: 'Current pinned route snapshot and compatibility baseline.',
    routeSnapshotVersion: '1.0.15',
    status: 'verified',
  },
  {
    imageTag: '1.0.16',
    label: '1.0.16',
    notes: PINNED_RELEASE_TARGET_NOTE,
    routeSnapshotVersion: '1.0.16',
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
