from decimal import Decimal

from pydantic import BaseModel, ConfigDict


class APIModel(BaseModel):
    """Shared base model for API schemas.

    Pydantic serialises ``Decimal`` as a JSON string by default, but the React
    client treats monetary fields as numbers (formatting, totals and bid
    arithmetic). Serialising decimals as JSON numbers keeps both sides aligned
    so the UI never has to guess whether a value is ``"1000.00"`` or ``1000``.
    """

    model_config = ConfigDict(json_encoders={Decimal: float})
