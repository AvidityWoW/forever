import { APLRotation } from '@generated/proto/apl';
import { Race } from '@generated/proto/common';
import { SavedTalents } from '@generated/proto/ui';
import { SimHostProvider } from '@sim/context/SimHostContext';
import type { PresetBuild } from '@sim/presets/types';
import { makeIndividualSim, serveDatabase } from '@testing/sim/individual_sim';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { PresetLinkDialog } from './PresetLinkDialog';

vi.mock('@i18n/config', () => ({ default: { t: (key: string) => key } }));
vi.mock('@sim/workers/worker_pool', async () => (await import('@testing/sim/worker_pool')).idleWorkerPool());

const toasts = vi.hoisted(() => [] as Array<{ variant: string; body: unknown }>);
vi.mock('@ui-kit/Toast', async importOriginal => ({
	...(await importOriginal<typeof import('@ui-kit/Toast')>()),
	toastManager: {
		add: (options: { variant: string; body: unknown }) => {
			toasts.push(options);
			return '';
		},
		close: () => {},
	},
}));

beforeAll(() => serveDatabase());
beforeEach(() => {
	toasts.length = 0;
});

const DESTRO: PresetBuild = {
	name: 'Destro',
	talents: { name: 'Destro', data: SavedTalents.create({ talentsString: '50' }) },
	settings: { name: 'Destro', race: Race.RaceOrc },
};

const open = async (search: string) => {
	window.history.replaceState(null, '', `/forever/warrior/dps/${search}`);
	const { player, host } = await makeIndividualSim({
		config: { autoRotation: () => APLRotation.create(), epStats: [], presets: { epWeights: [], builds: [DESTRO] } },
	});
	player.setRace(Race.RaceHuman);
	player.setTalentsString('05');
	render(
		<SimHostProvider host={host}>
			<PresetLinkDialog />
		</SimHostProvider>,
	);
	return player;
};

const row = (part: string) => within(screen.getByTestId(`preset-link-part-${part}`)).getByTestId('boolean-picker-input');

describe('PresetLinkDialog', () => {
	it('loads the ticked parts of the named preset and keeps the unticked ones', async () => {
		const player = await open('?preset=destro');

		await screen.findByTestId('preset-link-dialog');
		expect(window.location.search).toBe('');
		await userEvent.click(row('talents'));
		await userEvent.click(screen.getByTestId('preset-link-load'));

		expect(player.getTalentsString()).toBe('05');
		expect(player.getRace()).toBe(Race.RaceOrc);
		expect(screen.queryByTestId('preset-link-dialog')).toBeNull();
	});

	it('changes nothing on cancel', async () => {
		const player = await open('?preset=destro');

		await screen.findByTestId('preset-link-dialog');
		await userEvent.click(screen.getByText('common.cancel'));

		expect(player.getTalentsString()).toBe('05');
		expect(player.getRace()).toBe(Race.RaceHuman);
	});

	it('warns about a name no preset has and opens no dialog', async () => {
		await open('?preset=demo');

		await vi.waitFor(() => expect(toasts.map(toast => toast.variant)).toEqual(['warning']));
		expect(screen.queryByTestId('preset-link-dialog')).toBeNull();
		expect(window.location.search).toBe('');
	});
});
