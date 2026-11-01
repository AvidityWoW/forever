import { applyBuild } from '@features/settings/model/apply_build';
import type { Spec } from '@generated/proto/common';
import type { IndividualSimHost } from '@sim/sim_host';
import { batch } from '@sim/state/batch';

import { BUILD_PARTS, buildDifferences, type BuildPart } from './preset_build_state';
import type { PresetBuild } from './preset_utils';

// `?preset=<name>` on a spec page offers to load one of its preset builds.
export const PRESET_LINK_PARAM = 'preset';

/** A build's name in a link: lower case, each run of other characters one underscore, so "Aff (Wrack)" is `aff_wrack`. */
export const presetSlug = (name: string): string =>
	name
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '_')
		.replace(/^_|_$/g, '');

/** The preset a page's query string names, or null when it names none. */
export const presetLinkName = (search: string): string | null => new URLSearchParams(search).get(PRESET_LINK_PARAM) || null;

export const findPresetBuild = (builds: ReadonlyArray<PresetBuild>, name: string): PresetBuild | undefined =>
	builds.find(build => presetSlug(build.name) === presetSlug(name));

/**
 * The parts of the live settings loading the build would replace. Beside what differs, `applyBuild` turns item swap off
 * for a build that sets none, so an enabled swap is a part such a build replaces.
 */
export function presetLoadParts(build: PresetBuild, host: IndividualSimHost<Spec>): Array<BuildPart> {
	const parts = buildDifferences(build, host);
	if (host.player.itemSwapSettings.getEnableItemSwap() && !leavesItemSwapOn(build)) parts.push('item_swap');
	return BUILD_PARTS.filter(part => parts.includes(part));
}

/** Loads the build without the parts the user keeps, in one batch. */
export function loadPresetBuild(build: PresetBuild, host: IndividualSimHost<Spec>, keep: ReadonlyArray<BuildPart>) {
	batch(() => {
		const keepItemSwapOn = keep.includes('item_swap') && host.player.itemSwapSettings.getEnableItemSwap();
		applyBuild(withoutParts(build, keep), host);
		if (keepItemSwapOn) host.player.itemSwapSettings.setEnableItemSwap(true);
	});
}

// What `applyBuild` leaves the item swap toggle at: the settings' own toggle when they carry a swap, else on only for a build swap.
const leavesItemSwapOn = ({ itemSwap, settings }: PresetBuild): boolean =>
	settings?.playerOptions?.enableItemSwap !== undefined && settings.playerOptions.itemSwap ? settings.playerOptions.enableItemSwap : !!itemSwap;

function withoutParts(build: PresetBuild, parts: ReadonlyArray<BuildPart>): PresetBuild {
	const result: PresetBuild = { ...build };
	const settings = build.settings && { ...build.settings, playerOptions: build.settings.playerOptions && { ...build.settings.playerOptions } };
	const playerOptions = settings?.playerOptions;

	for (const part of parts) {
		switch (part) {
			case 'gear':
				delete result.gear;
				break;
			case 'item_swap':
				delete result.itemSwap;
				delete playerOptions?.enableItemSwap;
				delete playerOptions?.itemSwap;
				break;
			case 'talents':
				delete result.talents;
				break;
			case 'rotation':
				delete result.rotation;
				delete result.rotationType;
				break;
			case 'stat_weights':
				delete result.epWeights;
				break;
			case 'encounter':
				delete result.encounter;
				break;
			case 'class_spec_options':
				delete settings?.specOptions;
				break;
			case 'consumables':
				delete settings?.consumables;
				break;
			case 'buffs':
				delete settings?.raidBuffs;
				delete settings?.partyBuffs;
				delete settings?.buffs;
				break;
			case 'debuffs':
				delete settings?.debuffs;
				break;
			case 'other_settings':
				delete settings?.race;
				delete playerOptions?.profession1;
				delete playerOptions?.profession2;
				delete playerOptions?.distanceFromTarget;
				delete playerOptions?.reactionTimeMs;
				delete playerOptions?.channelClipDelayMs;
				delete playerOptions?.inFrontOfTarget;
				break;
		}
	}

	if (settings) result.settings = settings;
	return result;
}
