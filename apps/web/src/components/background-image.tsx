export function BackgroundImage() {
	return (
		<div
			className="fixed inset-0 z-0 bg-center bg-cover opacity-5 dark:opacity-5"
			style={{
				backgroundImage: "url(/background-image.png)",
			}}
		/>
	);
}
