function stringBSearch(array: string[], text: string): number {
    let low = 0;
    let high = array.length - 1;
    while (low <= high) {
        const mid = Math.floor((high + low) / 2);
        const midText = array[mid];
        if (midText == text) {
            return mid;
        }
        if (midText < text) {
            low = mid + 1;
        }
        if (midText > text) {
            high = mid - 1;
        }
    }
    return low;
}

export { stringBSearch };
