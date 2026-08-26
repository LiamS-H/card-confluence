export type FetchError =
	| {
			type: 'fetch_error';
			message: string;
	  }
	| {
			type: 'no_internet_error';
	  };

export interface JSONError {
	type: 'json_error';
	message: string;
}

export interface OPFSError {
	type: 'opfs_error';
	message: string;
}
