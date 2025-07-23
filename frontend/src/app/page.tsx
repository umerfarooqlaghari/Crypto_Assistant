'use client';

import CoinList from '../components/CoinList';

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-800">
      <CoinList />
    </div>
  );
}
