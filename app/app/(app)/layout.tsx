import Shell from "../_components/Shell";
import { TakenProvider } from "../_components/TakenContext";

export default function TakenAppLayout({ children }: { children: React.ReactNode }) {
  return (
    <TakenProvider>
      <Shell>{children}</Shell>
    </TakenProvider>
  );
}
