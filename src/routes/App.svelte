<script lang="ts">
	import { onMount } from 'svelte';

	// State variables
	let contractAddress = '';
	let holders: string[] = [];
	let clusters: { [key: string]: string | null } = {};
	let isClient = false;
	let targetType = 'evm';
	let targetAddresses: { [key: string]: string[] } = {};
	let hideEmpty = false;
	let selectedChain = '';
	let isLoading = false;
	let hasSearched = false;
	let csvData: string[] = [];
	let bitcoinAddressTypes: string[] = [];
	let litecoinAddressTypes: string[] = [];
	let rippleAddressTypes: string[] = [];
	let alchemyApiKey = '';
	let heliusApiKey = '';

	// Reactive declarations
	$: displayedHolders = hideEmpty
		? holders.filter((holder) => {
				const clusterName = clusters[holder] ? clusters[holder]!.split('/')[0] + '/' : '';
				return (targetAddresses[clusterName] || []).length > 0;
			})
		: holders;

	onMount(() => {
		isClient = true;
	});

	type Chain = {
		name: string;
		slug: string;
		type: 'evm' | 'solana';
		requiredKey: 'alchemy' | 'helius' | null;
	};

	const chains: Chain[] = [
		{ name: 'Ethereum', slug: 'eth-mainnet', type: 'evm', requiredKey: 'alchemy' },
		{ name: 'Arbitrum', slug: 'arb-mainnet', type: 'evm', requiredKey: 'alchemy' },
		{ name: 'Optimism', slug: 'opt-mainnet', type: 'evm', requiredKey: 'alchemy' },
		{ name: 'Base', slug: 'base-mainnet', type: 'evm', requiredKey: 'alchemy' },
		{ name: 'Polygon', slug: 'polygon-mainnet', type: 'evm', requiredKey: 'alchemy' },
		{ name: 'zkSync Era', slug: 'zksync-mainnet', type: 'evm', requiredKey: 'alchemy' },
		{ name: 'Solana', slug: 'solana', type: 'solana', requiredKey: 'helius' }
	];

	const targetTypes = [
		{ name: 'EVM', value: 'evm' },
		{ name: 'Solana', value: 'solana' },
		{ name: 'Bitcoin', value: 'bitcoin' },
		{ name: 'NEAR', value: 'near' },
		{ name: 'Dogecoin', value: 'dogecoin' },
		{ name: 'Aptos', value: 'aptos' },
		{ name: 'Tron', value: 'tron' },
		{ name: 'Hedera', value: 'hedera' },
		{ name: 'Stacks', value: 'stacks' },
		{ name: 'Algorand', value: 'algorand' },
		{ name: 'Filecoin', value: 'filecoin' },
		{ name: 'Litecoin', value: 'litecoin' },
		{ name: 'Ripple', value: 'ripple' },
		{ name: 'Cosmos', value: 'cosmos' },
		{ name: 'TON', value: 'ton' },
		{ name: 'Arweave', value: 'arweave' }
	];

	let fileInput: HTMLInputElement;

	function handleCsvUpload(event: Event) {
		const file = (event.target as HTMLInputElement).files?.[0];
		if (file) {
			const reader = new FileReader();
			reader.onload = (e) => {
				const text = e.target?.result as string;
				csvData = text
					.split('\n')
					.map((line) => line.trim())
					.filter((line) => line);
				selectedChain = '';
				contractAddress = '';
				alert(`CSV uploaded successfully. Parsed ${csvData.length} addresses.`);
			};
			reader.readAsText(file);
		}
	}

	function clearCsv() {
		csvData = [];
		contractAddress = '';
		if (fileInput) {
			fileInput.value = '';
		}
	}

	function handleAddressTypeChange(
		event: Event,
		setter: (updater: (prev: string[]) => string[]) => void
	) {
		const { value, checked } = event.target as HTMLInputElement;
		setter((prev: string[]) =>
			checked ? [...prev, value] : prev.filter((type) => type !== value)
		);
	}

	function handleBitcoinAddressTypeChange(event: Event) {
		handleAddressTypeChange(
			event,
			(updater) => (bitcoinAddressTypes = updater(bitcoinAddressTypes))
		);
	}

	function handleLitecoinAddressTypeChange(event: Event) {
		handleAddressTypeChange(
			event,
			(updater) => (litecoinAddressTypes = updater(litecoinAddressTypes))
		);
	}

	function handleRippleAddressTypeChange(event: Event) {
		handleAddressTypeChange(event, (updater) => (rippleAddressTypes = updater(rippleAddressTypes)));
	}

	async function fetchHolders() {
		if (!contractAddress && csvData.length === 0) {
			alert('Please enter a contract address or upload a CSV file');
			return;
		}

		isLoading = true;
		hasSearched = true;

		try {
			if (csvData.length > 0) {
				// Use the uploaded CSV addresses
				await fetchCSVHolders(csvData);
			} else {
				const selectedChainObj = chains.find((chain) => chain.slug === selectedChain);
				if (!selectedChainObj) {
					alert('Invalid chain selected');
					isLoading = false;
					return;
				}

				if (selectedChainObj.type === 'evm') {
					await fetchEVMHolders(selectedChainObj.slug);
				} else if (selectedChainObj.type === 'solana') {
					await fetchSolanaHolders();
				}
			}
		} catch (error) {
			console.error('Error fetching holders:', error);
			alert('An error occurred while fetching holders. Please try again.');
		} finally {
			isLoading = false;
		}
	}

	async function fetchCSVHolders(addresses: string[]) {
		try {
			if (addresses.length > 0) {
				holders = addresses;
				const clusterData = await fetchClusterNames(addresses);
				await fetchClusterAddresses(clusterData);
			} else {
				holders = [];
				alert('No holders found or an error occurred.');
			}
		} catch (error) {
			alert('Failed to fetch clusters');
		}
	}

	async function fetchEVMHolders(chainSlug: string) {
		try {
			const options = { method: 'GET', headers: { accept: 'application/json' } };
			const response = await fetch(
				`https://${chainSlug}.g.alchemy.com/v2/${alchemyApiKey}/getOwnersForCollection?contractAddress=${contractAddress}`,
				options
			);
			const data = await response.json();

			if (data.ownerAddresses) {
				holders = data.ownerAddresses;

				const clusterData = await fetchClusterNames(data.ownerAddresses);
				await fetchClusterAddresses(clusterData);
			} else {
				holders = [];
				alert('No holders found or an error occurred.');
			}
		} catch (err) {
			console.error(err);
			alert('Failed to retrieve holder addresses');
		}
	}

	async function fetchSolanaHolders() {
		let page = 1;
		let assetList: { NFTAddress: string; ownerAddress: string }[] = [];
		const url = `https://mainnet.helius-rpc.com/?api-key=${heliusApiKey}`;
		let hasMorePages = true;

		try {
			while (hasMorePages) {
				const response = await fetch(url, {
					method: 'POST',
					headers: {
						'Content-Type': 'application/json'
					},
					body: JSON.stringify({
						jsonrpc: '2.0',
						id: 'my-id',
						method: 'getAssetsByGroup',
						params: {
							groupKey: 'collection',
							groupValue: contractAddress,
							page: page,
							limit: 1000
						}
					})
				});

				const { result } = await response.json();
				const owners = result.items.map((item: any) => ({
					NFTAddress: item.id,
					ownerAddress: item.ownership.owner
				}));
				assetList = [...assetList, ...owners];

				if (result.items.length < 1000) {
					hasMorePages = false;
				} else {
					page++;
				}
			}

			const solanaHolders = assetList.map((item) => item.ownerAddress);
			holders = [...new Set(solanaHolders)];
			const clusterData = await fetchClusterNames(holders);
			await fetchClusterAddresses(clusterData);
		} catch (err) {
			console.error('Failed to fetch Solana holders:', err);
			alert('Failed to retrieve Solana NFT holders');
		}
	}

	async function fetchClusterNames(addresses: string[]) {
		try {
			const response = await fetch('http://api.clusters.xyz/v0.1/name/addresses', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify(addresses)
			});
			const data = await response.json();

			const filteredAddresses = data.filter((item: { name: string | null }) => item.name !== null);

			const clusterData: { [key: string]: string } = {};
			filteredAddresses.forEach((item: { address: string; name: string }) => {
				clusterData[item.address] = item.name!;
			});

			clusters = clusterData;
			return clusterData;
		} catch (err) {
			console.error(err);
			alert('Failed to retrieve cluster names');
			return {};
		}
	}

	async function fetchClusterAddresses(clusters: { [key: string]: string }) {
		try {
			const uniqueClusters = Array.from(
				new Set(Object.values(clusters).map((name) => name.split('/')[0] + '/'))
			);
			const response = await fetch('https://api.clusters.xyz/v0.1/cluster/names', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify(uniqueClusters)
			});
			const data = await response.json();

			const addresses: { [key: string]: string[] } = {};
			data.forEach((cluster: { name: string; wallets: { type: string; address: string }[] }) => {
				let filteredWallets = cluster.wallets;

				switch (targetType) {
					case 'bitcoin':
						filteredWallets = filteredWallets.filter((wallet) => {
							return (
								(bitcoinAddressTypes.includes('bitcoin-p2pkh') &&
									wallet.type === 'bitcoin-p2pkh') ||
								(bitcoinAddressTypes.includes('bitcoin-p2sh') && wallet.type === 'bitcoin-p2sh') ||
								(bitcoinAddressTypes.includes('bitcoin-p2wpkh-p2wsh') &&
									(wallet.type === 'bitcoin-p2wpkh' || wallet.type === 'bitcoin-p2wsh')) ||
								(bitcoinAddressTypes.includes('bitcoin-p2tr') && wallet.type === 'bitcoin-p2tr')
							);
						});
						break;
					case 'litecoin':
						filteredWallets = filteredWallets.filter((wallet) => {
							return (
								(litecoinAddressTypes.includes('litecoin-p2pkh') &&
									wallet.type === 'litecoin-p2pkh') ||
								(litecoinAddressTypes.includes('litecoin-p2sh') &&
									wallet.type === 'litecoin-p2sh') ||
								(litecoinAddressTypes.includes('litecoin-p2wpkh') &&
									wallet.type === 'litecoin-p2wpkh') ||
								(litecoinAddressTypes.includes('litecoin-p2wsh') &&
									wallet.type === 'litecoin-p2wsh')
							);
						});
						break;
					case 'ripple':
						filteredWallets = filteredWallets.filter((wallet) => {
							return (
								(rippleAddressTypes.includes('ripple-classic') &&
									wallet.type === 'ripple-classic') ||
								(rippleAddressTypes.includes('ripple-x') && wallet.type === 'ripple-x')
							);
						});
						break;
					case 'cosmos':
						filteredWallets = filteredWallets.filter(
							(wallet) => wallet.type === 'cosmos' || wallet.type.startsWith('cosmos-')
						);
						break;
					default:
						filteredWallets = filteredWallets.filter(
							(wallet) =>
								wallet.type === targetType &&
								(targetType !== 'evm' ||
									wallet.address !== '0x0000000000000000000000000000000000000000')
						);
						break;
				}

				addresses[cluster.name] = filteredWallets.map((wallet) => wallet.address);
			});

			targetAddresses = addresses;
		} catch (err) {
			console.error(err);
			alert('Failed to retrieve addresses for the clusters');
		}
	}

	function downloadCSV() {
		const maxTargetAddresses = Math.max(
			...holders.map((holder) => {
				const clusterName = clusters[holder] ? clusters[holder]!.split('/')[0] + '/' : '';
				return (targetAddresses[clusterName] || []).length;
			})
		);

		const headers = [
			'Holder Address',
			'Cluster Name',
			...Array(maxTargetAddresses)
				.fill(0)
				.map((_, i) => `Target Address ${i + 1}`)
		];

		const csvContent = [
			headers.join(','),
			...holders
				.map((holder) => {
					const clusterName = clusters[holder] ? clusters[holder]!.split('/')[0] + '/' : '';
					const targetAddrs = targetAddresses[clusterName] || [];

					if (hideEmpty && targetAddrs.length === 0) {
						return null;
					}

					const targetAddressColumns = Array(maxTargetAddresses)
						.fill('')
						.map((_, i) => targetAddrs[i] || '');

					return [holder, clusterName, ...targetAddressColumns].join(',');
				})
				.filter((row) => row !== null)
		].join('\n');

		const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
		const link = document.createElement('a');
		if (link.download !== undefined) {
			const url = URL.createObjectURL(blob);
			link.setAttribute('href', url);
			link.setAttribute('download', 'results.csv');
			link.style.visibility = 'hidden';
			document.body.appendChild(link);
			link.click();
			document.body.removeChild(link);
		}
	}
</script>

<div class="flex items-center justify-center min-h-screen bg-gray-100">
	<div class="bg-white p-8 rounded-lg shadow-lg w-full max-w-6xl text-sm">
		<h1 class="text-2xl font-bold mb-1 text-center text-blue-600">
			Crosschain Address Retrieval Tool
		</h1>
		<h2 class="text-base font-bold mb-1 text-center text-gray-600">
			Powered by <a href="https://clusters.xyz" target="_blank" class="text-cyan-600"
				>clusters.xyz</a
			>
		</h2>
		<h3 class="text-sm mb-8 text-center text-gray-600">
			NOTE: If you want snapshot support added for your source chain, send an API that pulls all
			holders of an NFT collection to <a
				href="https://x.com/0xZodomo"
				target="_blank"
				class="text-cyan-600">@0xZodomo</a
			> on X.
		</h3>

		<div class="flex space-x-4 mb-4">
			<div class="w-1/2">
				<label for="alchemy-api-key" class="block text-sm font-medium text-gray-700">
					<a href="https://dashboard.alchemy.com" target="_blank" class="text-cyan-600">Alchemy</a>
					API Key (required for EVM snapshots):
				</label>
				<input
					type="password"
					id="alchemy-api-key"
					bind:value={alchemyApiKey}
					class="mt-1 block w-full p-2 border border-gray-300 rounded-md shadow-sm text-gray-900"
					disabled={csvData.length > 0}
				/>
			</div>
			<div class="w-1/2">
				<label for="helius-api-key" class="block text-sm font-medium text-gray-700">
					<a href="https://dashboard.helius.dev" target="_blank" class="text-cyan-600">Helius</a> API
					Key (required for Solana snapshots):
				</label>
				<input
					type="password"
					id="helius-api-key"
					bind:value={heliusApiKey}
					class="mt-1 block w-full p-2 border border-gray-300 rounded-md shadow-sm text-gray-900"
					disabled={csvData.length > 0}
				/>
			</div>
		</div>

		<div class="flex space-x-4 mb-4">
			<div class="w-1/2">
				<label for="chain-select" class="block text-sm font-medium text-gray-700"
					>Select Source Chain (snapshot mode):</label
				>
				<select
					id="chain-select"
					bind:value={selectedChain}
					class="mt-1 block w-full p-2 border border-gray-300 rounded-md shadow-sm text-gray-900"
					disabled={csvData.length > 0}
				>
					<option value="" disabled>Select a chain</option>
					{#each chains as chain}
						<option
							value={chain.slug}
							disabled={(chain.requiredKey === 'alchemy' && !alchemyApiKey) ||
								(chain.requiredKey === 'helius' && !heliusApiKey)}
						>
							{chain.name}
						</option>
					{/each}
				</select>
				{#if selectedChain === 'solana'}
					<p class="mt-2 text-yellow-600 text-sm">
						⚠️ Please be patient, Solana snapshots take time to process.
					</p>
				{/if}
			</div>

			<div class="w-1/2">
				<label for="target-type" class="block text-sm font-medium text-gray-700"
					>Select Target Address Type:</label
				>
				<select
					id="target-type"
					bind:value={targetType}
					class="mt-1 block w-full p-2 border border-gray-300 rounded-md shadow-sm text-gray-900"
				>
					{#each targetTypes as type}
						<option value={type.value}>{type.name}</option>
					{/each}
				</select>

				{#if targetType === 'bitcoin'}
					<div class="grid grid-cols-2 gap-x-4 gap-y-2 mt-2">
						{#each ['P2PKH (1...)', 'P2SH (3...)', 'P2WPKH/P2WSH (bc1q...)', 'P2TR (bc1p...)'] as addressType, i}
							<label class="flex items-center text-sm font-medium text-gray-700">
								<input
									type="checkbox"
									value={['bitcoin-p2pkh', 'bitcoin-p2sh', 'bitcoin-p2wpkh-p2wsh', 'bitcoin-p2tr'][
										i
									]}
									checked={bitcoinAddressTypes.includes(
										['bitcoin-p2pkh', 'bitcoin-p2sh', 'bitcoin-p2wpkh-p2wsh', 'bitcoin-p2tr'][i]
									)}
									on:change={handleBitcoinAddressTypeChange}
									class="mr-2"
								/>
								{addressType}
							</label>
						{/each}
					</div>
				{/if}

				{#if targetType === 'litecoin'}
					<div class="grid grid-cols-2 gap-x-4 gap-y-2 mt-2">
						{#each ['P2PKH (L...)', 'P2SH (M...)', 'P2WPKH (ltc1...)'] as addressType, i}
							<label class="flex items-center text-sm font-medium text-gray-700">
								<input
									type="checkbox"
									value={['litecoin-p2pkh', 'litecoin-p2sh', 'litecoin-p2wpkh'][i]}
									checked={litecoinAddressTypes.includes(
										['litecoin-p2pkh', 'litecoin-p2sh', 'litecoin-p2wpkh'][i]
									)}
									on:change={handleLitecoinAddressTypeChange}
									class="mr-2"
								/>
								{addressType}
							</label>
						{/each}
					</div>
				{/if}

				{#if targetType === 'ripple'}
					<div class="flex flex-wrap gap-x-4 gap-y-2 mt-2">
						{#each ['Classic (r...)', 'X-Address (X...)'] as addressType, i}
							<label class="flex items-center text-sm font-medium text-gray-700">
								<input
									type="checkbox"
									value={['ripple-classic', 'ripple-x'][i]}
									checked={rippleAddressTypes.includes(['ripple-classic', 'ripple-x'][i])}
									on:change={handleRippleAddressTypeChange}
									class="mr-2"
								/>
								{addressType}
							</label>
						{/each}
					</div>
				{/if}
			</div>
		</div>

		<div class="flex space-x-4 mb-4">
			<div class="w-1/2">
				<label for="contract-address" class="block text-sm font-medium text-gray-700"
					>Enter Collection Contract Address (snapshot mode):</label
				>
				<input
					type="text"
					id="contract-address"
					bind:value={contractAddress}
					class="mt-1 block w-full p-2 border border-gray-300 rounded-md shadow-sm text-gray-900"
					disabled={csvData.length > 0}
				/>
			</div>

			<div class="w-1/2 flex items-end">
				<div class="flex-grow">
					<label for="upload-csv" class="block text-sm font-medium text-gray-700"
						>Upload address list without headers (manual mode, can be mixed types):</label
					>
					<input
						type="file"
						id="upload-csv"
						bind:this={fileInput}
						accept=".csv"
						on:change={handleCsvUpload}
						class="mt-1 block w-full p-2 border border-gray-300 rounded-md shadow-sm text-gray-900"
						disabled={contractAddress !== ''}
					/>
				</div>
				{#if csvData.length > 0}
					<button
						on:click={clearCsv}
						class="ml-2 mt-1 bg-red-500 text-white py-2 px-4 rounded hover:bg-red-600"
					>
						Clear
					</button>
				{/if}
			</div>
		</div>

		<div class="mb-4 flex">
			<label for="hide-empty" class="block text-sm font-medium text-gray-700"
				>Hide holders without target addresses:</label
			>
			<input type="checkbox" id="hide-empty" bind:checked={hideEmpty} class="ml-2 mt-1" />
		</div>

		<div class="flex space-x-2 mb-4">
			<button
				on:click={fetchHolders}
				class="flex-1 bg-blue-500 text-white py-2 px-4 rounded hover:bg-blue-600 flex items-center justify-center"
				disabled={isLoading}
			>
				{#if isLoading}
					<div class="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
					Processing...
				{:else}
					Retrieve Addresses
				{/if}
			</button>
			{#if !isLoading && holders.length > 0}
				<button
					on:click={downloadCSV}
					class="flex-1 bg-green-500 text-white py-2 px-4 rounded hover:bg-green-600"
				>
					Download Results
				</button>
			{/if}
		</div>

		<div class="mt-1 text-center text-gray-600">
			NOTE: You must handle deduplicating multiple source addresses appearing in the same Cluster
			and Clusters containing multiple target addresses.
		</div>

		<div id="results">
			{#if !isLoading && hasSearched}
				{#if holders.length === 0}
					<p class="text-center text-gray-500">No holder addresses found.</p>
				{:else}
					<div class="overflow-x-auto">
						<table class="w-full text-left border-collapse mt-4">
							<thead>
								<tr>
									<th class="border-b-2 p-2 text-gray-700">Holder Address</th>
									<th class="border-b-2 p-2 text-gray-700">Cluster Name</th>
									<th class="border-b-2 p-2 text-gray-700">Target Addresses</th>
								</tr>
							</thead>
							<tbody>
								{#each displayedHolders as holder}
									{@const clusterName = clusters[holder]
										? (clusters[holder] || '').split('/')[0] + '/'
										: ''}
									{@const targetAddrs = targetAddresses[clusterName] || []}
									<tr>
										<td class="border-b p-2 text-gray-900">{holder}</td>
										<td class="border-b p-2 text-gray-900">{clusterName}</td>
										<td class="border-b p-2 text-gray-900">
											{#each targetAddrs as addr}
												<div>{addr}</div>
											{/each}
										</td>
									</tr>
								{:else}
									<tr>
										<td colspan="3" class="text-center text-gray-500 py-4">
											No target addresses found.
										</td>
									</tr>
								{/each}
							</tbody>
						</table>
					</div>
				{/if}
			{/if}
		</div>

		<div class="mt-8 text-center text-gray-600">
			Author: Zodomo/ <a href="https://x.com/0xZodomo" target="_blank" class="text-cyan-600">[X]</a>
			<a href="https://warpcast.com/zodomo" target="_blank" class="text-cyan-600">[FC]</a>
			<a href="https://t.me/zodomo" target="_blank" class="text-cyan-600">[TG]</a>
			<a href="https://github.com/zodomo" target="_blank" class="text-cyan-600">[GH]</a>
		</div>
	</div>
</div>
