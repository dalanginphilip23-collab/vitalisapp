import NeuralStatusCard from "./NeuralStatusCard.jsx";
import SessionLog from "./SessionLog.jsx";


// Right column: session log + how-it-works. Live form metrics live in the
// rep status card (page level) and the complete summary — not duplicated here.
export default function RightPanel({ logs }) {
  return (
    <div className="col-span-1 lg:col-span-4 flex flex-col gap-4 sm:gap-6">
      <SessionLog logs={logs} />
      <NeuralStatusCard />
    </div>
  );
}