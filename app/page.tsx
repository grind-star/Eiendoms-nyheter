import EiendomApp from "./components/EiendomApp";

export const revalidate = 0; // aldri cache – alltid fersk data fra Supabase

export default function Home() {
  return <EiendomApp />;
}
