export type FetchError =
	| {
			type: 'fetch_error';
			status_code: number;
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
