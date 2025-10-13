export namespace app {
	
	export class JWTResult {
	    valid: boolean;
	    algorithm: string;
	    header: Record<string, any>;
	    claims: Record<string, any>;
	    iat?: number;
	    nbf?: number;
	    exp?: number;
	    error?: string;
	    warnings?: string[];
	    signature?: string;
	
	    static createFrom(source: any = {}) {
	        return new JWTResult(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.valid = source["valid"];
	        this.algorithm = source["algorithm"];
	        this.header = source["header"];
	        this.claims = source["claims"];
	        this.iat = source["iat"];
	        this.nbf = source["nbf"];
	        this.exp = source["exp"];
	        this.error = source["error"];
	        this.warnings = source["warnings"];
	        this.signature = source["signature"];
	    }
	}

}

