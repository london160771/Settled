import { api } from '../api/client.js';
import { useLoad, ErrorBox, ReceiptsTable } from '../components/ui.jsx';

export default function Receipts() {
  const { data, error } = useLoad(() => api('/receipts'));
  return (
    <>
      <h1>Receipts</h1>
      <p className="lede">
        Every Telegraph purchase made from your wallet. The receipt hash is the proof ID. A row
        marked Charged on failure is a failed paid ask, counted as spent until it is reconciled with
        the Telegraph ledger.
      </p>
      <ErrorBox error={error} />
      <ReceiptsTable receipts={data?.receipts} showCase />
    </>
  );
}
