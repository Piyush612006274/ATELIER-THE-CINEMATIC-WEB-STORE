export type Role = "USER" | "ADMIN";
export type OrderStatus = "PENDING_PAYMENT" | "PAID" | "PROCESSING" | "SHIPPED" | "DELIVERED" | "CANCELLED" | "REFUNDED";
export type PaymentStatus = "CREATED" | "PENDING" | "AUTHORIZED" | "CAPTURED" | "FAILED" | "REFUNDED";
export type CollectionType = "MEN" | "WOMEN_INDO_WESTERN" | "WOMEN_WESTERN";

export type Product = {
  id:string; sku:string; name:string; slug:string; price:number; currency:string;
  categoryId:string; gender:string; collectionType:CollectionType; type:string; description:string;
  colors:string[]; sizes:string[]; images:string[]; rating:number; reviewCount:number;
  stock:number; featured:boolean; newArrival:boolean; bestSeller:boolean; status:string;
  category?: { id:string; name:string; slug:string };
};

export type Address = {
  id?:string; firstName:string; lastName:string; phone:string; addressLine1:string;
  addressLine2?:string; city:string; state:string; postalCode:string; country:string; isDefault?:boolean;
};

export type CartItem = { id:string; productId:string; quantity:number; size:string; color:string; product:Product };
