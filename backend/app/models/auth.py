from pydantic import BaseModel, EmailStr


class InviteRequest(BaseModel):
    email: EmailStr
    display_name: str | None = None


class InviteResponse(BaseModel):
    email: str
    invited: bool
    detail: str = ""
