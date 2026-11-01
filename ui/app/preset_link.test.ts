import { Race } from '@generated/proto/common';
import { SavedTalents } from '@generated/proto/ui';
import type { PresetBuild } from '@sim/presets/types';
import { makeIndividualSim, serveDatabase } from '@testing/sim/individual_sim';
import { swapSet, SWORD, weaponsDatabase } from '@testing/sim/weapons';
import { beforeAll, describe, expect, it, vi } from 'vitest';

import { findPresetBuild, loadPresetBuild, presetLinkName, presetLoadParts, presetSlug } from './preset_link';

vi.mock('@sim/workers/worker_pool', async () => (await import('@testing/sim/worker_pool')).idleWorkerPool());

beforeAll(() => serveDatabase(weaponsDatabase()));

const talents = (talentsString: string) => ({ name: 'P1', data: SavedTalents.create({ talentsString }) });

describe('preset link names', () => {
	it('reads a build name as its file name would spell it', () => {
		expect(presetSlug('Aff (Wrack)')).toBe('aff_wrack');
		expect(presetSlug('SM/Ruin')).toBe('sm_ruin');
		expect(presetSlug('SV Weave')).toBe('sv_weave');
	});

	it('finds a build by its link name or by its display name', () => {
		const builds: Array<PresetBuild> = [{ name: 'Destro' }, { name: 'Aff (Wrack)' }];

		expect(findPresetBuild(builds, 'aff_wrack')?.name).toBe('Aff (Wrack)');
		expect(findPresetBuild(builds, 'Aff (Wrack)')?.name).toBe('Aff (Wrack)');
		expect(findPresetBuild(builds, 'demo')).toBeUndefined();
	});

	it('reads the preset parameter and nothing else from the query string', () => {
		expect(presetLinkName('?preset=destro')).toBe('destro');
		expect(presetLinkName('?i=rtg')).toBeNull();
		expect(presetLinkName('?preset=')).toBeNull();
	});
});

describe('presetLoadParts', () => {
	it('lists the parts that differ and leaves out the ones that match', async () => {
		const { player, host } = await makeIndividualSim();
		player.setRace(Race.RaceHuman);
		player.setTalentsString('05');

		const parts = presetLoadParts({ name: 'P1', talents: talents('05'), settings: { name: 'P1', race: Race.RaceOrc } }, host);

		expect(parts).toEqual(['other_settings']);
	});

	it('lists item swap for a build that sets none while the live swap is on', async () => {
		const { player, host } = await makeIndividualSim();
		player.itemSwapSettings.setItemSwapSettings(true, host.sim.db.lookupItemSwap(swapSet({ mainHand: SWORD })));

		expect(presetLoadParts({ name: 'P1', talents: talents('05') }, host)).toEqual(['item_swap', 'talents']);
	});
});

describe('loadPresetBuild', () => {
	it('replaces the ticked parts and keeps the unticked ones', async () => {
		const { player, host } = await makeIndividualSim();
		player.setRace(Race.RaceHuman);
		player.setTalentsString('05');

		loadPresetBuild({ name: 'P1', talents: talents('50'), settings: { name: 'P1', race: Race.RaceOrc } }, host, ['talents']);

		expect(player.getTalentsString()).toBe('05');
		expect(player.getRace()).toBe(Race.RaceOrc);
	});

	it('keeps the live item swap on when its row is unticked', async () => {
		const { player, host } = await makeIndividualSim();
		player.itemSwapSettings.setItemSwapSettings(true, host.sim.db.lookupItemSwap(swapSet({ mainHand: SWORD })));

		loadPresetBuild({ name: 'P1', talents: talents('50') }, host, ['item_swap']);

		expect(player.itemSwapSettings.getEnableItemSwap()).toBe(true);
		expect(player.getTalentsString()).toBe('50');
	});
});
