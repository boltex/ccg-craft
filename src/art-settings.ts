export type ArtLoadingOptions = {
    highResolution: boolean;
    useDatabase: boolean;
    revision: number;
};

let currentOptions: ArtLoadingOptions = {
    highResolution: false,
    useDatabase: false,
    revision: 0,
};

export function setArtLoadingOptions(
    options: Pick<ArtLoadingOptions, "highResolution" | "useDatabase">
): ArtLoadingOptions {
    currentOptions = {
        ...options,
        revision: currentOptions.revision + 1,
    };
    return getArtLoadingOptions();
}

export function getArtLoadingOptions(): ArtLoadingOptions {
    return { ...currentOptions };
}

export function canUseLocalArtDatabase(options: ArtLoadingOptions): boolean {
    return options.useDatabase && options.revision === currentOptions.revision;
}