import WorkerProfilePage from "./mi-informacion-laboral/page"

interface PageProps {
  searchParams?: Promise<{ returnTo?: string; onboarding?: string }>
}

export default async function ProfilePage({ searchParams }: PageProps) {
  return <WorkerProfilePage searchParams={searchParams} />
}
