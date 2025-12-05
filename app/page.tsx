import { Button } from '@/components/ui/button'
import styles from './page.module.scss'
import Link from 'next/link'
import Header from '@/components/home/Header'
export default function Home() {
	return (
		<div>
			<Header />
			<Link href='auth/login'>
				<Button className={styles.main}>Login</Button>
			</Link>
			<Link href='auth/register'>
				<Button className={styles.main}>Sign Up</Button>
			</Link>
		</div>
	)
}
