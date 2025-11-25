import React from 'react';
import { Config } from '../types';

interface Stats {
    valid: { count: number; stars: number };
    credit: { count: number; stars: number };
    total: { count: number; stars: number };
}

interface StatsInfoProps {
    stats: Stats;
    config: Config;
    isCompact?: boolean;
}

export const StatsInfo: React.FC<StatsInfoProps> = ({ stats, config, isCompact = false }) => {
    if (!config) return null;

    // Logic update: "Fill" the valid budget with credit votes visually,
    // only show the "Credit" text for what TRULY overflows.
    const totalPhotos = stats.valid.count + stats.credit.count;
    const totalStars = stats.valid.stars + stats.credit.stars;

    const displayPhotos = Math.min(totalPhotos, config.ratedPhotoLimit);
    const displayStars = Math.min(totalStars, config.totalStarsLimit);

    const excessPhotos = Math.max(0, totalPhotos - config.ratedPhotoLimit);
    const excessStars = Math.max(0, totalStars - config.totalStarsLimit);

    const ratedRemaining = config.ratedPhotoLimit - displayPhotos;
    const starsRemaining = config.totalStarsLimit - displayStars;

    const hasCredit = excessPhotos > 0 || excessStars > 0;

    const creditDetails = [];
    if (excessPhotos > 0) {
        creditDetails.push(`${excessPhotos} фото`);
    }
    if (excessStars > 0) {
        let starText = `${excessStars} звёзд`;
        // Context: If we are over star limit, but NOT photo limit, explain where these stars are hiding
        if (excessPhotos === 0 && stats.credit.count > 0) {
            starText += ` (на ${stats.credit.count} фото)`;
        }
        creditDetails.push(starText);
    }

    const creditString = creditDetails.join(', ');

    if (isCompact) {
        return (
            <div className="text-xs flex items-center gap-2">
                <div>
                    Оценено: <span className="font-bold text-indigo-400">{displayPhotos}/{config.ratedPhotoLimit}</span>
                </div>
                <span className="text-gray-500">|</span>
                <div>
                    Звёзд: <span className="font-bold text-yellow-400">{displayStars}/{config.totalStarsLimit}</span>
                </div>
                {hasCredit && (
                    <>
                        <span className="text-gray-500">|</span>
                        <span className="font-bold text-red-500 animate-pulse">(+{creditString} в кредите)</span>
                    </>
                )}
            </div>
        );
    }

    return (
        <div className="text-sm space-y-1 text-center text-gray-300 w-full">
            <div>
                Вы оценили фотографий: <span className="font-bold text-white">{displayPhotos} / {config.ratedPhotoLimit}</span>
                , осталось: <span className="font-bold text-indigo-400">{ratedRemaining >= 0 ? ratedRemaining : 0}</span>
            </div>
            <div>
                Израсходовали звезд: <span className="font-bold text-white">{displayStars} / {config.totalStarsLimit}</span>
                , осталось: <span className="font-bold text-yellow-400">{starsRemaining >= 0 ? starsRemaining : 0}</span>
            </div>
            {hasCredit && (
                <div className="text-red-400 font-semibold mt-1">
                    Внимание: В кредите: {creditString}
                </div>
            )}
        </div>
    );
};
