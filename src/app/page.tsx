'use client';

import { useState, useEffect, useRef } from 'react';

export default function Home() {
  const [contractAddress, setContractAddress] = useState<string>('');
  const [holders, setHolders] = useState<string[]>([]);
  const [clusters, setClusters] = useState<{[key: string]: string | null}>({});
  const [isClient, setIsClient] = useState(false);
  const [targetType, setTargetType] = useState<string>('evm');
  const [targetAddresses, setTargetAddresses] = useState<{[key: string]: string[]}>({});
  const [hideEmpty, setHideEmpty] = useState<boolean>(false);
  const [selectedChain, setSelectedChain] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [hasSearched, setHasSearched] = useState<boolean>(false);
  const [csvData, setCsvData] = useState<string[]>([]);
  const [bitcoinAddressTypes, setBitcoinAddressTypes] = useState<string[]>([]);
  const [litecoinAddressTypes, setLitecoinAddressTypes] = useState<string[]>([]);
  const [rippleAddressTypes, setRippleAddressTypes] = useState<string[]>([]);
  const [alchemyApiKey, setAlchemyApiKey] = useState<string>('');
  const [heliusApiKey, setHeliusApiKey] = useState<string>('');

  useEffect(() => {
    setIsClient(true);
  }, []);

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
    { name: 'Solana', slug: 'solana', type: 'solana', requiredKey: 'helius' },
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
  ];

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleCsvUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const text = e.target?.result as string;
        const addresses = text.split('\n').map(line => line.trim()).filter(line => line);
        setCsvData(addresses);
        setSelectedChain('');
        setContractAddress('');
        alert('CSV uploaded successfully. Parsed ' + addresses.length + ' addresses.');
      };
      reader.readAsText(file);
    }
  };

  const clearCsv = () => {
    setCsvData([]);
    setContractAddress('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleBitcoinAddressTypeChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const { value, checked } = event.target;
    setBitcoinAddressTypes((prev) =>
      checked ? [...prev, value] : prev.filter((type) => type !== value)
    );
  };

  const handleAddressTypeChange = (event: React.ChangeEvent<HTMLInputElement>, setter: React.Dispatch<React.SetStateAction<string[]>>) => {
    const { value, checked } = event.target;
    setter((prev) =>
      checked ? [...prev, value] : prev.filter((type) => type !== value)
    );
  };

  const fetchHolders = async () => {
    if (!contractAddress && csvData.length === 0) {
      alert('Please enter a contract address or upload a CSV file');
      return;
    }

    setIsLoading(true);
    setHasSearched(true);

    try {
      if (csvData.length > 0) {
        // Use the uploaded CSV addresses
        await fetchCSVHolders(csvData);
      } else {
        const selectedChainObj = chains.find(chain => chain.slug === selectedChain);
        if (!selectedChainObj) {
          alert('Invalid chain selected');
          setIsLoading(false);
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
      setIsLoading(false);
    }
  };

  const fetchCSVHolders = async (addresses: string[]) => {
    try {
      if (addresses.length > 0) {
        setHolders(addresses);
        const clusterData = await fetchClusterNames(addresses);
        await fetchClusterAddresses(clusterData);
      } else {
        setHolders([]);
        alert('No holders found or an error occurred.');
      }
    } catch (error) {
      alert('Failed to fetch clusters');
    }
  };

  const fetchEVMHolders = async (chainSlug: string) => {
    try {
      const options = { method: 'GET', headers: { accept: 'application/json' } };
      const response = await fetch(
        `https://${chainSlug}.g.alchemy.com/v2/${alchemyApiKey}/getOwnersForCollection?contractAddress=${contractAddress}`,
        options
      );
      const data = await response.json();

      if (data.ownerAddresses) {
        setHolders(data.ownerAddresses);

        const clusterData = await fetchClusterNames(data.ownerAddresses);
        await fetchClusterAddresses(clusterData);
      } else {
        setHolders([]);
        alert('No holders found or an error occurred.');
      }
    } catch (err) {
      console.error(err);
      alert('Failed to retrieve holder addresses');
    }
  };

  const fetchSolanaHolders = async () => {
    let page = 1;
    let assetList: { NFTAddress: string; ownerAddress: string }[] = [];
    const url = `https://mainnet.helius-rpc.com/?api-key=${heliusApiKey}`;
    let hasMorePages = true;
  
    try {
      while (hasMorePages) {
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            jsonrpc: '2.0',
            id: 'my-id',
            method: 'getAssetsByGroup',
            params: {
              groupKey: 'collection',
              groupValue: contractAddress,
              page: page,
              limit: 1000,
            },
          }),
        });
  
        const { result } = await response.json();
        const owners = result.items.map((item: any) => ({
          NFTAddress: item.id,
          ownerAddress: item.ownership.owner,
        }));
        assetList.push(...owners);
  
        if (result.items.length < 1000) {
          hasMorePages = false;
        } else {
          page++;
        }
      }
  
      const solanaHolders = assetList.map(item => item.ownerAddress);
      const uniqueSolanaHolders = solanaHolders.filter((address, index, self) =>
        self.indexOf(address) === index
      );
      setHolders(uniqueSolanaHolders);
      const clusterData = await fetchClusterNames(uniqueSolanaHolders);
      await fetchClusterAddresses(clusterData);
    } catch (err) {
      console.error('Failed to fetch Solana holders:', err);
      alert('Failed to retrieve Solana NFT holders');
    }
  };

  const fetchClusterNames = async (addresses: string[]) => {
    try {
      const response = await fetch('http://api.clusters.xyz/v0.1/name/addresses', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(addresses),
      });
      const data = await response.json();
  
      const filteredAddresses = data.filter((item: { name: string | null }) => item.name !== null);
  
      const clusterData: { [key: string]: string } = {};
      filteredAddresses.forEach((item: { address: string; name: string }) => {
        clusterData[item.address] = item.name!;
      });
  
      setClusters(clusterData);
      return clusterData;
    } catch (err) {
      console.error(err);
      alert('Failed to retrieve cluster names');
      return {};
    }
  };  
  
  const fetchClusterAddresses = async (clusters: { [key: string]: string }) => {
    try {
      const uniqueClusters = Array.from(new Set(Object.values(clusters).map(name => name.split('/')[0] + '/')));
      const response = await fetch('https://api.clusters.xyz/v0.1/cluster/names', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(uniqueClusters),
      });
      const data = await response.json();
  
      const addresses: { [key: string]: string[] } = {};
      data.forEach((cluster: { name: string; wallets: { type: string; address: string }[] }) => {
        let filteredWallets = cluster.wallets;
  
        switch (targetType) {
          case 'bitcoin':
            filteredWallets = filteredWallets.filter(wallet => {
              return (
                (bitcoinAddressTypes.includes('bitcoin-p2pkh') && wallet.type === 'bitcoin-p2pkh') ||
                (bitcoinAddressTypes.includes('bitcoin-p2sh') && wallet.type === 'bitcoin-p2sh') ||
                (bitcoinAddressTypes.includes('bitcoin-p2wpkh-p2wsh') &&
                  (wallet.type === 'bitcoin-p2wpkh' || wallet.type === 'bitcoin-p2wsh')) ||
                (bitcoinAddressTypes.includes('bitcoin-p2tr') && wallet.type === 'bitcoin-p2tr')
              );
            });
            break;
          case 'litecoin':
            filteredWallets = filteredWallets.filter(wallet => {
              return (
                (litecoinAddressTypes.includes('litecoin-p2pkh') && wallet.type === 'litecoin-p2pkh') ||
                (litecoinAddressTypes.includes('litecoin-p2sh') && wallet.type === 'litecoin-p2sh') ||
                (litecoinAddressTypes.includes('litecoin-p2wpkh') && wallet.type === 'litecoin-p2wpkh') ||
                (litecoinAddressTypes.includes('litecoin-p2wsh') && wallet.type === 'litecoin-p2wsh')
              );
            });
            break;
          case 'ripple':
            filteredWallets = filteredWallets.filter(wallet => {
              return (
                (rippleAddressTypes.includes('ripple-classic') && wallet.type === 'ripple-classic') ||
                (rippleAddressTypes.includes('ripple-x') && wallet.type === 'ripple-x')
              );
            });
            break;
          case 'cosmos':
            filteredWallets = filteredWallets.filter(wallet => 
              wallet.type === 'cosmos' || wallet.type.startsWith('cosmos-')
            );
            break;
          default:
            filteredWallets = filteredWallets.filter(wallet => 
              wallet.type === targetType && 
              (targetType !== 'evm' || wallet.address !== '0x0000000000000000000000000000000000000000')
            );
            break;
        }
  
        addresses[cluster.name] = filteredWallets.map(wallet => wallet.address);
      });
  
      setTargetAddresses(addresses);
    } catch (err) {
      console.error(err);
      alert('Failed to retrieve addresses for the clusters');
    }
  };

  const downloadCSV = () => {
    // Determine the maximum number of target addresses for any holder
    const maxTargetAddresses = Math.max(...holders.map(holder => {
      const clusterName = clusters[holder] ? clusters[holder]!.split('/')[0] + '/' : '';
      return (targetAddresses[clusterName] || []).length;
    }));
  
    // Create headers with numbered target address columns
    const headers = ['Holder Address', 'Cluster Name', ...Array(maxTargetAddresses).fill(0).map((_, i) => `Target Address ${i + 1}`)];
    
    const csvContent = [
      headers.join(','),
      ...holders.map(holder => {
        const clusterName = clusters[holder] ? clusters[holder]!.split('/')[0] + '/' : '';
        const targetAddrs = targetAddresses[clusterName] || [];
        
        // Skip this holder if hideEmpty is true and there are no target addresses
        if (hideEmpty && targetAddrs.length === 0) {
          return null;
        }
  
        // Fill in target addresses, leaving empty strings for missing addresses
        const targetAddressColumns = Array(maxTargetAddresses).fill('').map((_, i) => targetAddrs[i] || '');
  
        return [
          holder,
          clusterName,
          ...targetAddressColumns
        ].join(',');
      }).filter(row => row !== null) // Remove null entries
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
  };

  if (!isClient) {
    return null;
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100">
      <div className="bg-white p-8 rounded-lg shadow-lg w-full max-w-6xl text-sm">
        <h1 className="text-2xl font-bold mb-1 text-center text-blue-600">Crosschain Address Retrieval Tool</h1>
        <h2 className="text-base font-bold mb-1 text-center text-gray-600">Powered by <a href='https://clusters.xyz' target="_blank" className="text-cyan-600">clusters.xyz</a></h2>
        <h3 className="text-sm mb-8 text-center text-gray-600">NOTE: If you want snapshot support added for your source chain, send an API that pulls all holders of an NFT collection to <a href="https://x.com/0xZodomo" target="_blank" className="text-cyan-600">@0xZodomo</a> on X.</h3>
  
        <div className="flex space-x-4 mb-4">
          <div className="w-1/2">
            <label htmlFor="alchemy-api-key" className="block text-sm font-medium text-gray-700"><a href="https://dashboard.alchemy.com" target="_blank" className="text-cyan-600">Alchemy</a> API Key (required for EVM snapshots):</label>
            <input
              type="password"
              id="alchemy-api-key"
              value={alchemyApiKey}
              onChange={(e) => setAlchemyApiKey(e.target.value)}
              className="mt-1 block w-full p-2 border border-gray-300 rounded-md shadow-sm text-gray-900"
              disabled={csvData.length > 0}
            />
          </div>
          <div className="w-1/2">
            <label htmlFor="helius-api-key" className="block text-sm font-medium text-gray-700"><a href="https://dashboard.helius.dev" target="_blank" className="text-cyan-600">Helius</a> API Key (required for Solana snapshots):</label>
            <input
              type="password"
              id="helius-api-key"
              value={heliusApiKey}
              onChange={(e) => setHeliusApiKey(e.target.value)}
              className="mt-1 block w-full p-2 border border-gray-300 rounded-md shadow-sm text-gray-900"
              disabled={csvData.length > 0}
            />
          </div>
        </div>

        <div className="flex space-x-4 mb-4">
          <div className="w-1/2">
            <label htmlFor="chain-select" className="block text-sm font-medium text-gray-700">Select Source Chain (snapshot mode):</label>
            <select
              id="chain-select"
              value={selectedChain}
              onChange={(e) => setSelectedChain(e.target.value)}
              className="mt-1 block w-full p-2 border border-gray-300 rounded-md shadow-sm text-gray-900"
              disabled={csvData.length > 0}
            >
              <option value="" disabled>Select a chain</option>
              {chains.map((chain) => (
                <option 
                  key={chain.slug} 
                  value={chain.slug}
                  disabled={(chain.requiredKey === 'alchemy' && !alchemyApiKey) || (chain.requiredKey === 'helius' && !heliusApiKey)}
                >
                  {chain.name}
                </option>
              ))}
            </select>
            {selectedChain === 'solana' && (
              <p className="mt-2 text-yellow-600 text-sm">⚠️ Please be patient, Solana snapshots take time to process.</p>
            )}
          </div>

          <div className="w-1/2">
            <label htmlFor="target-type" className="block text-sm font-medium text-gray-700">Select Target Address Type:</label>
            <select
              id="target-type"
              value={targetType}
              onChange={(e) => setTargetType(e.target.value)}
              className="mt-1 block w-full p-2 border border-gray-300 rounded-md shadow-sm text-gray-900"
            >
              {targetTypes.map((type) => (
                <option key={type.value} value={type.value}>{type.name}</option>
              ))}
            </select>
            
            {targetType === 'bitcoin' && (
              <div className="grid grid-cols-2 gap-x-4 gap-y-2 mt-2">
                <label className="flex items-center text-sm font-medium text-gray-700">
                  <input
                    type="checkbox"
                    value="bitcoin-p2pkh"
                    checked={bitcoinAddressTypes.includes('bitcoin-p2pkh')}
                    onChange={(e) => handleAddressTypeChange(e, setBitcoinAddressTypes)}
                    className="mr-2"
                  />
                  P2PKH (1...)
                </label>
                <label className="flex items-center text-sm font-medium text-gray-700">
                  <input
                    type="checkbox"
                    value="bitcoin-p2sh"
                    checked={bitcoinAddressTypes.includes('bitcoin-p2sh')}
                    onChange={(e) => handleAddressTypeChange(e, setBitcoinAddressTypes)}
                    className="mr-2"
                  />
                  P2SH (3...)
                </label>
                <label className="flex items-center text-sm font-medium text-gray-700">
                  <input
                    type="checkbox"
                    value="bitcoin-p2wpkh-p2wsh"
                    checked={bitcoinAddressTypes.includes('bitcoin-p2wpkh-p2wsh')}
                    onChange={(e) => handleAddressTypeChange(e, setBitcoinAddressTypes)}
                    className="mr-2"
                  />
                  P2WPKH/P2WSH (bc1q...)
                </label>
                <label className="flex items-center text-sm font-medium text-gray-700">
                  <input
                    type="checkbox"
                    value="bitcoin-p2tr"
                    checked={bitcoinAddressTypes.includes('bitcoin-p2tr')}
                    onChange={(e) => handleAddressTypeChange(e, setBitcoinAddressTypes)}
                    className="mr-2"
                  />
                  P2TR (bc1p...)
                </label>
              </div>
            )}

            {targetType === 'litecoin' && (
              <div className="flex flex-wrap gap-x-4 gap-y-2 mt-2">
                <label className="flex items-center text-sm font-medium text-gray-700">
                  <input
                    type="checkbox"
                    value="litecoin-p2pkh"
                    checked={litecoinAddressTypes.includes('litecoin-p2pkh')}
                    onChange={(e) => handleAddressTypeChange(e, setLitecoinAddressTypes)}
                    className="mr-2"
                  />
                  P2PKH (L...)
                </label>
                <label className="flex items-center text-sm font-medium text-gray-700">
                  <input
                    type="checkbox"
                    value="litecoin-p2sh"
                    checked={litecoinAddressTypes.includes('litecoin-p2sh')}
                    onChange={(e) => handleAddressTypeChange(e, setLitecoinAddressTypes)}
                    className="mr-2"
                  />
                  P2SH (M...)
                </label>
                <label className="flex items-center text-sm font-medium text-gray-700">
                  <input
                    type="checkbox"
                    value="litecoin-p2wpkh"
                    checked={litecoinAddressTypes.includes('litecoin-p2wpkh')}
                    onChange={(e) => handleAddressTypeChange(e, setLitecoinAddressTypes)}
                    className="mr-2"
                  />
                  P2WPKH/P2WSH (ltc1q...)
                </label>
              </div>
            )}

            {targetType === 'ripple' && (
              <div className="flex flex-wrap gap-x-4 gap-y-2 mt-2">
                <label className="flex items-center text-sm font-medium text-gray-700">
                  <input
                    type="checkbox"
                    value="ripple-classic"
                    checked={rippleAddressTypes.includes('ripple-classic')}
                    onChange={(e) => handleAddressTypeChange(e, setRippleAddressTypes)}
                    className="mr-2"
                  />
                  Classic (r...)
                </label>
                <label className="flex items-center text-sm font-medium text-gray-700">
                  <input
                    type="checkbox"
                    value="ripple-x"
                    checked={rippleAddressTypes.includes('ripple-x')}
                    onChange={(e) => handleAddressTypeChange(e, setRippleAddressTypes)}
                    className="mr-2"
                  />
                  X-Address (X...)
                </label>
              </div>
            )}
          </div>
        </div>
  
        <div className="flex space-x-4 mb-4">
          <div className="w-1/2">
            <label htmlFor="contract-address" className="block text-sm font-medium text-gray-700">Enter Collection Contract Address (snapshot mode):</label>
            <input
              type="text"
              id="contract-address"
              placeholder=""
              value={contractAddress}
              onChange={(e) => setContractAddress(e.target.value)}
              className="mt-1 block w-full p-2 border border-gray-300 rounded-md shadow-sm text-gray-900"
              disabled={csvData.length > 0} // Disable when CSV is uploaded
            />
          </div>

          <div className="w-1/2 flex items-end">
            <div className="flex-grow">
              <label htmlFor="upload-csv" className="block text-sm font-medium text-gray-700">Upload address list without headers (manual mode, can be mixed types):</label>
              <input
                type="file"
                id="upload-csv"
                ref={fileInputRef}
                accept=".csv"
                onChange={handleCsvUpload}
                className="mt-1 block w-full p-2 border border-gray-300 rounded-md shadow-sm text-gray-900"
                disabled={contractAddress !== ''}
              />
            </div>
            {csvData.length > 0 && (
              <button
                onClick={clearCsv}
                className="ml-2 mt-1 bg-red-500 text-white py-2 px-4 rounded hover:bg-red-600"
              >
                Clear
              </button>
            )}
          </div>
        </div>
  
        <div className="mb-4 flex">
          <label htmlFor="hide-empty" className="block text-sm font-medium text-gray-700">Hide holders without target addresses:</label>
          <input
            type="checkbox"
            id="hide-empty"
            checked={hideEmpty}
            onChange={(e) => setHideEmpty(e.target.checked)}
            className="ml-2 mt-1"
          />
        </div>
  
        <div className="flex space-x-2 mb-4">
          <button
            onClick={fetchHolders}
            className="flex-1 bg-blue-500 text-white py-2 px-4 rounded hover:bg-blue-600 flex items-center justify-center"
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                Processing...
              </>
            ) : (
              'Retrieve Addresses'
            )}
          </button>
          {!isLoading && holders.length > 0 && (
            <button
              onClick={downloadCSV}
              className="flex-1 bg-green-500 text-white py-2 px-4 rounded hover:bg-green-600"
            >
              Download Results
            </button>
          )}
        </div>

        <div className="mt-1 text-center text-gray-600">
          NOTE: You must handle deduplicating multiple source addresses appearing in the same Cluster and Clusters containing multiple target addresses.
        </div>
  
        <div id="results">
          {!isLoading && hasSearched && (
            <>
              {holders.length === 0 ? (
                <p className="text-center text-gray-500">No holder addresses found.</p>
              ) : (
                <>
                  <h3 className="text-lg font-medium">Holder Addresses:</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse mt-4">
                      <thead>
                        <tr>
                          <th className="border-b-2 p-2 text-gray-700">Holder Address</th>
                          <th className="border-b-2 p-2 text-gray-700">Cluster Name</th>
                          <th className="border-b-2 p-2 text-gray-700">Target Addresses</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(() => {
                          const displayedAddresses: {[key: string]: boolean} = {};
                          let hasTargetAddresses = false;
                          const rows = holders.map((holder, index) => {
                            const clusterName = clusters[holder] ? clusters[holder]!.split('/')[0] + '/' : '';
                            const targetAddrs = targetAddresses[clusterName] || [];
    
                            if (hideEmpty && targetAddrs.length === 0) {
                              return null;
                            }
    
                            if (displayedAddresses[holder]) {
                              return null; // Skip duplicate addresses
                            }
                            displayedAddresses[holder] = true;
    
                            if (targetAddrs.length > 0) {
                              hasTargetAddresses = true;
                            }
    
                            return (
                              <tr key={index}>
                                <td className="border-b p-2 text-gray-900">{holder}</td>
                                <td className="border-b p-2 text-gray-900">{clusterName}</td>
                                <td className="border-b p-2 text-gray-900">
                                  {targetAddrs.map((addr, i) => (
                                    <div key={i}>{addr}</div>
                                  ))}
                                </td>
                              </tr>
                            );
                          }).filter(row => row !== null);

                          if (rows.length === 0 || !hasTargetAddresses) {
                            return (
                              <tr>
                                <td colSpan={3} className="text-center text-gray-500 py-4">
                                  No target addresses found.
                                </td>
                              </tr>
                            );
                          }

                          return rows;
                        })()}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </>
          )}
        </div>
        <div className="mt-8 text-center text-gray-600">
          Author: Zodomo/ <a href="https://x.com/0xZodomo" target="_blank" className="text-cyan-600">[X]</a> <a href="https://warpcast.com/zodomo" target="_blank" className="text-cyan-600">[FC]</a> <a href="https://t.me/zodomo" target="_blank" className="text-cyan-600">[TG]</a> <a href="https://github.com/zodomo" target="_blank" className="text-cyan-600">[GH]</a>
        </div>
      </div>
    </div>
  );  
}