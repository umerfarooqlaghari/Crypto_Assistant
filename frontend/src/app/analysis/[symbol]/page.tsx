'use client';

import { useParams } from 'next/navigation';
import CryptoAssistant from '../../../components/CryptoAssistant';

export default function CoinAnalysisPage() {
  const params = useParams();
  const symbol = params.symbol as string;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-800">
      <CryptoAssistant initialSymbol={symbol?.toUpperCase()} />
    </div>
  );
}
