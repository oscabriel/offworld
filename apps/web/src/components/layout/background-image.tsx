export function BackgroundImage() {
	return (
		<div
			className="fixed inset-0 z-0 bg-cover bg-center opacity-5 dark:opacity-5"
			style={{
				backgroundImage: "url(/background-image.png)",
			}}
		/>
	);
}
