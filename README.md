# Thu Chi

Sổ dòng tiền, ngân sách và công nợ cho điện thoại. Dữ liệu nằm trên chính máy đang mở app, không cần bật máy tính.

Bản dùng hằng ngày: https://hikhai.github.io/QL_Dong_Tien/

## Dùng như app trên điện thoại

1. Mở link ở trên bằng Chrome (Android) hoặc Safari (iPhone).
2. Đăng ký một tên đăng nhập. Mật khẩu chỉ dùng để vào sổ trên máy này và để xác nhận khi sửa ví.
3. Thêm ra màn hình chính:
   - **Android:** menu trình duyệt → **Thêm vào Màn hình chính** hoặc **Cài đặt ứng dụng**.
   - **iPhone:** nút Chia sẻ → **Thêm vào Màn hình chính**.
4. Lần sau bấm icon **Thu Chi**. Máy tính không cần bật. Sau lần mở đầu, app vẫn mở được khi mất mạng.

Mỗi điện thoại có sổ riêng. Bạn bè cài trên máy của họ thì không thấy số của bạn. Trên cùng một điện thoại, mỗi tên đăng nhập là một sổ khác.

## Mang sổ từ máy tính sang điện thoại

Nếu trước đó sổ nằm trên máy tính, xuất tệp JSON (Cài đặt → **Xuất sổ**), gửi tệp sang điện thoại, rồi trong app trên điện thoại chọn **Nhập sổ**.

## Chạy khi đang sửa mã

```powershell
npm install
npm run dev
```

Mở http://localhost:3000. Lệnh `npm test` kiểm tra cách tính số dư và công nợ.
