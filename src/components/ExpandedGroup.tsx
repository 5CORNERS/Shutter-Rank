import React, { useState, useEffect } from 'react';
import { PhotoStack, Settings, Photo } from '../types';
import { ChevronUp } from 'lucide-react';
import { PhotoCard } from './PhotoCard';

interface ExpandedGroupProps {
    item: PhotoStack;
    groupData: any;
    isClosing: boolean;
    expandedGroupId: string | null;
    showHiddenPhotos: boolean;
    hidingPhotoId: number | null;
    settings: Settings | null;
    onCollapse: (groupId: string) => void;
    onRate: (photoId: number, rating: number) => void;
    onImageClick: (photo: Photo) => void;
    onToggleVisibility: (photoId: number) => void;
    groupSelections: Record<string, number | null>;
    onSelectionChange: (groupId: string, photoId: number | null) => void;
    isTouchDevice: boolean;
    starsUsed: number;
    totalStarsLimit: number;
    ratedPhotosCount: number;
    ratedPhotoLimit: number;
    hasCreditVotes?: boolean;
}

export const ExpandedGroup: React.FC<ExpandedGroupProps> = ({
                                    item,
                                    groupData,
                                    isClosing,
                                    expandedGroupId,
                                    showHiddenPhotos,
                                    hidingPhotoId,
                                    settings,
                                    onCollapse,
                                    onRate,
                                    onImageClick,
                                    onToggleVisibility,
                                    groupSelections,
                                    onSelectionChange,
                                    isTouchDevice,
                                    starsUsed,
                                    totalStarsLimit,
                                    ratedPhotosCount,
                                    ratedPhotoLimit,
                                    hasCreditVotes = false
                                }) => {
    // Determine if this instance should be expanded. 
    // It is expanded if the ID matches OR if it's currently in the closing animation phase.
    const isExpanded = expandedGroupId === item.groupId;
    const photosToShow = showHiddenPhotos ? item.photos : item.photos.filter(p => p.isVisible !== false || p.id === hidingPhotoId);

    // Internal state to trigger the class application AFTER mount
    const [animateOpen, setAnimateOpen] = useState(false);

    useEffect(() => {
        if (isExpanded) {
            // Force a reflow/paint in the collapsed state first
            requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                    setAnimateOpen(true);
                });
            });
        } else if (isClosing) {
            setAnimateOpen(false);
        }
    }, [isExpanded, isClosing]);

    return (
        <div className="col-span-full" key={`expanded-${item.groupId}`}>
            <div id={`expanded-group-wrapper-${item.groupId}`} className={`expanded-group-wrapper ${animateOpen ? 'expanded' : ''}`}>
                <div className="expanded-group-container">
                    <div className="expanded-group-content">
                        <div className="expanded-group-grid-wrapper opacity-0">
                            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center pt-1 gap-3">
                                <div className="flex items-center gap-4">
                                    <div>
                                        <h3 className="text-lg font-bold text-gray-200 flex items-center gap-3">
                                            Группа «{groupData?.name || ''}»
                                            <button onClick={() => onCollapse(item.groupId)} className="flex items-center gap-1 text-sm px-3 py-1 rounded-full bg-indigo-600/20 text-indigo-300 hover:bg-indigo-600/30 hover:text-indigo-200 font-semibold transition-colors flex-shrink-0 ml-2">
                                                <ChevronUp size={16}/>
                                                Свернуть
                                            </button>
                                        </h3>
                                        {groupData?.caption && <p className="text-sm text-gray-400 mt-1">{groupData.caption}</p>}
                                    </div>
                                </div>
                            </div>
                            <div className={`pt-4 ${settings?.layout === 'grid'
                                ? "grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6"
                                : "sm:columns-2 md:columns-3 lg:columns-4 gap-6 space-y-6"
                            }`}>
                                {photosToShow.map(photo => {
                                    const isSelected = item.selectedPhotoId === photo.id;
                                    const isDimmed = item.selectedPhotoId !== null && !isSelected;
                                    return (
                                        <div key={photo.id} className={settings?.layout === 'original' ? 'break-inside-avoid' : ''}>
                                            <PhotoCard
                                                photo={photo}
                                                onRate={onRate}
                                                onImageClick={onImageClick}
                                                displayVotes={false}
                                                layoutMode={settings?.layout || 'grid'}
                                                gridAspectRatio={settings?.gridAspectRatio || '4/3'}
                                                onToggleVisibility={onToggleVisibility}
                                                isDimmed={isDimmed}
                                                isHiding={hidingPhotoId === photo.id}
                                                showSelectionControl={true}
                                                isSelected={isSelected}
                                                onSelect={() => {
                                                    const currentSelection = groupSelections[item.groupId] || null;
                                                    const newSelectedId = currentSelection === photo.id ? null : photo.id;
                                                    onSelectionChange(item.groupId, newSelectedId);
                                                }}
                                                isFilterActive={showHiddenPhotos}
                                                starsUsed={starsUsed}
                                                totalStarsLimit={totalStarsLimit}
                                                ratedPhotosCount={ratedPhotosCount}
                                                ratedPhotoLimit={ratedPhotoLimit}
                                                hasCreditVotes={hasCreditVotes}
                                            />
                                        </div>
                                    )
                                })}
                            </div>
                            <div className="flex justify-center pt-6">
                                <button onClick={() => onCollapse(item.groupId)} className="flex items-center gap-2 text-sm text-indigo-400 hover:text-indigo-300 font-semibold transition-colors">
                                    <ChevronUp size={18}/>
                                    Свернуть группу
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}