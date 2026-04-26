export class ResponseBody<T>{

    public success? : boolean;
    public data? : T;
    public message? : string;

    public Map(dto:any){
        this.success = dto.success;
        this.data = dto.data;
        this.message = dto.message;
        return this;
    }
}