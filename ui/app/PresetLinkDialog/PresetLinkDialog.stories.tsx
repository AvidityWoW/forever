import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { expect, fn, userEvent, within } from 'storybook/test';

import type { BuildPart } from '../preset_build_state';
import { PresetLinkDialogView, type PresetLinkDialogViewProps } from './PresetLinkDialog';

const meta = {
	title: 'App/PresetLinkDialog/PresetLinkDialog',
	component: PresetLinkDialogView,
	tags: ['autodocs'],
	args: {
		open: true,
		name: 'Destro',
		parts: ['gear', 'item_swap', 'talents', 'rotation', 'consumables', 'buffs'],
		keep: [],
		onToggle: fn(),
		onLoad: fn(),
		onCancel: fn(),
	},
} satisfies Meta<typeof PresetLinkDialogView>;

export default meta;
type Story = StoryObj<typeof meta>;

const TogglingDialog = (props: PresetLinkDialogViewProps) => {
	const [keep, setKeep] = useState<Array<BuildPart>>([]);
	return (
		<PresetLinkDialogView
			{...props}
			parts={['talents', 'rotation']}
			keep={keep}
			onToggle={(part, replace) => setKeep(current => (replace ? current.filter(kept => kept !== part) : [...current, part]))}
		/>
	);
};

export const EveryPartTicked: Story = {};

export const SomePartsKept: Story = {
	args: { keep: ['item_swap', 'buffs'] },
};

/** Unticking every row leaves nothing to load, so the load button turns off. */
export const Interactive: Story = {
	render: args => <TogglingDialog {...args} />,
	play: async ({ canvasElement }) => {
		const body = within(canvasElement.ownerDocument.body);
		for (const part of ['talents', 'rotation']) {
			await userEvent.click(within(body.getByTestId(`preset-link-part-${part}`)).getByTestId('boolean-picker-input'));
		}
		await expect(body.getByTestId('preset-link-load')).toBeDisabled();
	},
};
