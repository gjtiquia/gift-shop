import { cartRevision, type Cart } from "./cartStorage";

export interface CartRenderToken {
    generation: number;
    revision: string;
}

export class CartPageState {
    private generation = 0;
    private renderedRevision: string | null = null;

    beginRender(cart: Cart): CartRenderToken {
        this.renderedRevision = null;
        return {
            generation: ++this.generation,
            revision: cartRevision(cart),
        };
    }

    acceptRender(token: CartRenderToken, currentCart: Cart) {
        if (!this.isCurrentRender(token, currentCart)) return false;
        this.renderedRevision = token.revision;
        return true;
    }

    isCurrentRender(token: CartRenderToken, currentCart: Cart) {
        return (
            token.generation === this.generation &&
            token.revision === cartRevision(currentCart)
        );
    }

    acceptRenderedRevision(revision: string, currentCart: Cart) {
        if (revision !== cartRevision(currentCart)) return false;
        this.renderedRevision = revision;
        return true;
    }

    canSubmit(cart: Cart) {
        return this.renderedRevision === cartRevision(cart);
    }
}
