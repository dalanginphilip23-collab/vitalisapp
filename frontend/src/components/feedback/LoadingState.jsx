import BrandLoader from '../ui/BrandLoader.jsx';
export default function LoadingState({ message='Loading...' }) {
  return <div role="status" aria-busy="true" aria-live="polite" className="flex flex-col items-center justify-center py-12 min-h-[200px]"><BrandLoader size="sm" message={message} /></div>;
}
