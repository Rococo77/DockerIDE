import React, { useEffect, useState } from 'react';

const ImageMarketplace: React.FC = () => {
	const [images, setImages] = useState<any[]>([]);
	const [term, setTerm] = useState('');

	const fetchImages = async () => {
		if (!window.electronAPI || !window.electronAPI.docker) {
			setImages([]);
			return;
		}
		const res = await window.electronAPI.docker.listImages();
		if (res.success) setImages(res.data);
	};

	useEffect(() => {
		fetchImages();
	}, []);

	const search = async () => {
		if (!term) return;
		if (!window.electronAPI || !window.electronAPI.docker) return;
		const res = await window.electronAPI.docker.searchImage(term);
		if (res.success) {
			// show search results temporarily
			setImages(res.data);
		}
	};

	return (
		<div>
			<div className="flex gap-2 mb-2">
				<input value={term} onChange={(e) => setTerm(e.target.value)} placeholder="Rechercher une image" />
				<button className="px-2 py-1 bg-blue-600 text-white rounded" onClick={search}>Search</button>
			</div>
			<ul>
				{images.map((img: any) => (
					<li key={img.Id || img.name}>{img.RepoTags?.[0] ?? img.Name ?? img.description ?? img.Id}</li>
				))}
			</ul>
		</div>
	);
};

export default ImageMarketplace;
