import i18n from '@i18n/config';
import { useSimHost, useSpecPresets } from '@sim/context/SimHostContext';
import { useSimReady } from '@sim/hooks/useSimReady';
import { BooleanPicker } from '@ui-kit/BooleanPicker';
import { Button } from '@ui-kit/Button';
import { Dialog } from '@ui-kit/Dialog';
import { toastManager } from '@ui-kit/Toast';
import { useEffect, useRef, useState } from 'react';

import type { BuildPart } from '../preset_build_state';
import { findPresetBuild, loadPresetBuild, PRESET_LINK_PARAM, presetLinkName, presetLoadParts } from '../preset_link';
import type { PresetBuild } from '../preset_utils';

export interface PresetLinkDialogViewProps {
	open: boolean;
	name: string;
	/** The parts the load replaces, each a row of the checklist. */
	parts: ReadonlyArray<BuildPart>;
	/** The unticked rows, which the load leaves as they are. */
	keep: ReadonlyArray<BuildPart>;
	onToggle: (part: BuildPart, replace: boolean) => void;
	onLoad: () => void;
	onCancel: () => void;
}

export const PresetLinkDialogView = ({ open, name, parts, keep, onToggle, onLoad, onCancel }: PresetLinkDialogViewProps) => (
	<Dialog
		open={open}
		onOpenChange={next => !next && onCancel()}
		size="sm"
		title={i18n.t('common.preset_link.title', { name })}
		testId="preset-link-dialog"
		footer={
			<>
				<Button variant="outline-primary" className="mr-2" onClick={onCancel}>
					{i18n.t('common.cancel')}
				</Button>
				<Button variant="primary" disabled={keep.length === parts.length} onClick={onLoad} data-testid="preset-link-load">
					{i18n.t('common.preset_link.load')}
				</Button>
			</>
		}>
		<p className="mb-2">{i18n.t('common.preset_link.description')}</p>
		<div className="flex flex-col gap-y-1">
			{parts.map(part => (
				<BooleanPicker
					key={part}
					id={`preset-link-${part}`}
					label={i18n.t(`common.preset.${part}`)}
					layout="inline"
					density="compact"
					value={!keep.includes(part)}
					onChange={replace => onToggle(part, replace)}
					testId={`preset-link-part-${part}`}
				/>
			))}
		</div>
	</Dialog>
);

interface PendingLoad {
	build: PresetBuild;
	parts: Array<BuildPart>;
}

/** Offers the preset build a `?preset=` link names once the saved settings have loaded, and takes the parameter off the address. */
export const PresetLinkDialog = () => {
	const host = useSimHost();
	const presets = useSpecPresets();
	const ready = useSimReady();
	const read = useRef(false);
	const [pending, setPending] = useState<PendingLoad | null>(null);
	const [keep, setKeep] = useState<Array<BuildPart>>([]);

	useEffect(() => {
		if (!ready || read.current) return;
		read.current = true;

		const name = presetLinkName(window.location.search);
		if (!name) return;
		const url = new URL(window.location.href);
		url.searchParams.delete(PRESET_LINK_PARAM);
		window.history.replaceState(window.history.state, '', url);

		const build = findPresetBuild(presets.builds ?? [], name);
		if (!build) {
			toastManager.add({ variant: 'warning', body: i18n.t('common.preset_link.not_found', { name }) });
			return;
		}
		const parts = presetLoadParts(build, host);
		if (!parts.length) {
			toastManager.add({ variant: 'info', body: i18n.t('common.preset_link.already_loaded', { name: build.name }) });
			return;
		}
		setPending({ build, parts });
	}, [ready, host, presets]);

	const close = () => setPending(null);

	return (
		<PresetLinkDialogView
			open={!!pending}
			name={pending?.build.name ?? ''}
			parts={pending?.parts ?? []}
			keep={keep}
			onToggle={(part, replace) => setKeep(current => (replace ? current.filter(kept => kept !== part) : [...current, part]))}
			onLoad={() => {
				if (pending) loadPresetBuild(pending.build, host, keep);
				close();
			}}
			onCancel={close}
		/>
	);
};
