import { Debuffs, IndividualBuffs, PartyBuffs, RaidBuffs } from '@generated/proto/buffs';
import { ConsumesSpec, Encounter, EquipmentSpec, HealingModel, ItemSwap, Spec } from '@generated/proto/common';
import { SavedTalents } from '@generated/proto/ui';
import i18n from '@i18n/config';
import { translatePresetConfigurationCategory } from '@i18n/localization';
import { PresetConfigurationCategory } from '@sim/constants/preset_categories';
import { isEqualAPLRotation } from '@sim/proto/apl_utils';
import { Stats } from '@sim/proto/stats';
import type { IndividualSimHost } from '@sim/sim_host';

import type { PresetBuild } from './preset_utils';

// Keys the walk below must not name: `phase`/`group` are grouping metadata rather than settings,
// and the rest are re-added by their own rules so they read once rather than under two labels.
const NON_CATEGORY_BUILD_KEYS = ['name', 'encounter', 'settings', 'phase', 'group', 'epWeights', 'reforgeSettings'];

/** The categories a build touches, as the chip tooltip lists them: de-duplicated and sorted. */
export function buildCategories(build: PresetBuild): Array<string> {
	const categories: Array<string> = [];

	Object.keys(build).forEach(key => {
		if (!NON_CATEGORY_BUILD_KEYS.includes(key) && build[key as PresetConfigurationCategory]) {
			categories.push(translatePresetConfigurationCategory(key as PresetConfigurationCategory));
		}
	});

	if (build.encounter?.encounter) categories.push(translatePresetConfigurationCategory(PresetConfigurationCategory.Encounter));
	if (build.epWeights) categories.push(i18n.t('common.preset.stat_weights'));
	if (build.reforgeSettings) categories.push(i18n.t('common.preset.reforge_settings'));

	if (build.settings) {
		Object.keys(build.settings).forEach(key => {
			if (key === 'name') return;
			if (key === 'specOptions') categories.push(i18n.t('common.preset.class_spec_options'));
			else if (key === 'consumables') categories.push(i18n.t('common.preset.consumables'));
			else if (key === 'reforgeSettings') categories.push(i18n.t('common.preset.reforge_settings'));
			else if (key === 'debuffs') categories.push(i18n.t('common.preset.debuffs'));
			else if (['buffs', 'raidBuffs', 'partyBuffs'].includes(key)) categories.push(i18n.t('common.preset.buffs'));
			else categories.push(i18n.t('common.preset.other_settings'));
		});
	}

	return [...new Set(categories)].sort();
}

/** A part of a build that its load can change, named by its `common.preset` label key. */
export type BuildPart =
	| 'gear'
	| 'item_swap'
	| 'talents'
	| 'rotation'
	| 'stat_weights'
	| 'encounter'
	| 'class_spec_options'
	| 'consumables'
	| 'buffs'
	| 'debuffs'
	| 'other_settings';

export const BUILD_PARTS: ReadonlyArray<BuildPart> = [
	'gear',
	'item_swap',
	'talents',
	'rotation',
	'stat_weights',
	'encounter',
	'class_spec_options',
	'consumables',
	'buffs',
	'debuffs',
	'other_settings',
];

/**
 * Whether the live settings already match the build, scoped to the categories the picker showing
 * the chip cares about: a gear-tab chip lights up on gear alone, even when the build also carries
 * talents the player has not loaded.
 */
export function isBuildActive(build: PresetBuild, simUI: IndividualSimHost<Spec>, categories?: Array<PresetConfigurationCategory>): boolean {
	return buildDifferences(build, simUI, categories).length === 0;
}

/** The parts of the build the live settings differ from, in a fixed order; a part the build leaves out never differs. */
export function buildDifferences(
	{ gear, rotation, rotationType, talents, epWeights, encounter, settings }: PresetBuild,
	simUI: IndividualSimHost<Spec>,
	categories?: Array<PresetConfigurationCategory>,
): Array<BuildPart> {
	const checks = (category: PresetConfigurationCategory) => !categories || categories.includes(category);
	const differs = new Set<BuildPart>();

	if (checks(PresetConfigurationCategory.Gear) && gear && !EquipmentSpec.equals(gear.gear, simUI.player.getGear().asSpec())) differs.add('gear');
	if (
		checks(PresetConfigurationCategory.Talents) &&
		talents &&
		!SavedTalents.equals(talents.data, SavedTalents.create({ talentsString: simUI.player.getTalentsString() }))
	)
		differs.add('talents');

	if (checks(PresetConfigurationCategory.Rotation)) {
		if (rotationType) {
			if (rotationType !== simUI.player.getRotationType()) differs.add('rotation');
		} else if (rotation?.rotation.rotation) {
			if (!isEqualAPLRotation(simUI.player, simUI.player.getResolvedAplRotation(), rotation.rotation.rotation)) differs.add('rotation');
		}
	}

	if (checks(PresetConfigurationCategory.EPWeights) && epWeights && !simUI.player.getEpWeights().equals(epWeights.epWeights)) differs.add('stat_weights');

	if (checks(PresetConfigurationCategory.Encounter)) {
		if (encounter?.encounter && !Encounter.equals({ ...encounter.encounter, apiVersion: 0 }, { ...simUI.sim.encounter.toProto(), apiVersion: 0 }))
			differs.add('encounter');
		if (encounter?.healingModel && !HealingModel.equals(encounter.healingModel, simUI.player.getHealingModel())) differs.add('encounter');
	}

	if (checks(PresetConfigurationCategory.Settings)) {
		const playerOptions = settings?.playerOptions;
		if (settings?.race && simUI.player.getRace() !== settings.race) differs.add('other_settings');
		if (playerOptions?.profession1 !== undefined && simUI.player.getProfession1() !== playerOptions.profession1) differs.add('other_settings');
		if (playerOptions?.profession2 !== undefined && simUI.player.getProfession2() !== playerOptions.profession2) differs.add('other_settings');
		if (playerOptions?.distanceFromTarget !== undefined && simUI.player.getDistanceFromTarget() !== playerOptions.distanceFromTarget)
			differs.add('other_settings');
		if (playerOptions?.enableItemSwap !== undefined && simUI.player.itemSwapSettings.getEnableItemSwap() !== playerOptions.enableItemSwap)
			differs.add('item_swap');
		if (
			playerOptions?.itemSwap !== undefined &&
			(playerOptions.enableItemSwap || simUI.player.itemSwapSettings.getEnableItemSwap()) &&
			!isEqualItemSwap(simUI.player.itemSwapSettings.toProto(), playerOptions.itemSwap)
		)
			differs.add('item_swap');
		if (
			settings?.specOptions &&
			Object.keys(settings.specOptions).length &&
			JSON.stringify(simUI.player.getSpecOptions()) != JSON.stringify(settings.specOptions)
		)
			differs.add('class_spec_options');
		if (settings?.consumables && !ConsumesSpec.equals(simUI.player.getConsumes(), settings.consumables)) differs.add('consumables');
		if (settings?.partyBuffs && !PartyBuffs.equals(simUI.player.getParty()?.getBuffs(), settings.partyBuffs)) differs.add('buffs');
		if (settings?.raidBuffs && !RaidBuffs.equals(simUI.sim.raid.getBuffs(), settings.raidBuffs)) differs.add('buffs');
		if (settings?.buffs && !IndividualBuffs.equals(simUI.player.getBuffs(), settings.buffs)) differs.add('buffs');
		if (settings?.debuffs && !Debuffs.equals(simUI.sim.raid.getDebuffs(), settings.debuffs)) differs.add('debuffs');
	}

	return BUILD_PARTS.filter(part => differs.has(part));
}

/**
 * Compares the items and the prepull bonus stats by value: the live swap always carries a prepull stats
 * message, while a preset's JSON usually leaves it out, and neither apiVersion is part of the setting.
 */
function isEqualItemSwap(live: ItemSwap, preset: ItemSwap): boolean {
	return (
		ItemSwap.equals(ItemSwap.create({ items: live.items }), ItemSwap.create({ items: preset.items })) &&
		Stats.fromProto(live.prepullBonusStats).equals(Stats.fromProto(preset.prepullBonusStats))
	);
}
