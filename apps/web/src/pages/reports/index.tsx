import { useEffect } from 'react';
import { useRouter } from 'next/router';

export default function ReportsIndexPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/reports/financial');
  }, [router]);
  return null;
}
