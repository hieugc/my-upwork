# CODEMAP

## Initial Upwork web portfolio — cập nhật 2026-09-26

### Files cần sửa
| File | Vai trò hiện tại | Thay đổi cần làm |
|---|---|---|
| mockups/chainpulse-phase2.html | Phase 2 approved visual reference | Giữ nguyên làm design evidence |
| package.json | Chưa tồn tại | Tạo scripts/dependencies cho Next.js portfolio |
| app/* | Chưa tồn tại | Tạo portfolio hub, 8 static demo routes, metadata |
| components/* | Chưa tồn tại | Tạo shared navigation và 8 differentiated product experiences |
| data/products.json | Chưa tồn tại | Tạo content catalog cho 8 products |
| tests/* | Chưa tồn tại | Tạo automated catalog integrity tests |
| .github/workflows/ci.yml | Chưa tồn tại | Tạo CI lint/test/build |
| DESIGN.md | Chưa tồn tại | Ghi durable visual/UX contract |
| ARCHITECTURE.md | Chưa tồn tại | Ghi Phase 3-8 architecture/deploy decisions |

### Dependencies bị ảnh hưởng
| File | Quan hệ với file cần sửa |
|---|---|
| Không có legacy source | Project app chưa tồn tại trước implementation |
| mockups/chainpulse-phase2.html | Là source-of-truth trực quan cho ChainPulse, không bị overwrite |

### Bảng/Entity DB liên quan
| Bảng | Cột liên quan | Ràng buộc (FK/Index) cần chú ý |
|---|---|---|
| Không có | Không có | Portfolio dùng static content, không cần DB |

### Test hiện có bao phủ vùng này
| File test | Kịch bản đang test |
|---|---|
| Không có | Sẽ bổ sung catalog integrity test + build/lint/browser verification |

### Ảnh hưởng
Tạo mới một static-export Next.js portfolio hub với 8 demo websites: ChainPulse, OrbitOps, MetricFlow, Maison Estate, NOMA Coffee, AURA Commerce, Northstar Studio, LedgerX UI. Không thêm backend, auth, payment, database hay external APIs trong initial portfolio build.


## Phase 9 execution impact map — cập nhật 2026-09-26

### Files cần sửa
| File | Vai trò hiện tại | Thay đổi cần làm |
|---|---|---|
| package.json | Next.js scripts/dependencies | Bổ sung typecheck và quality scripts nếu thiếu |
| app/* | Portfolio hub + static demo routes | Giữ kiến trúc, sửa lỗi phát hiện qua verification |
| components/ProductExperience.tsx | 8 differentiated demo experiences | Giữ/hoàn thiện interaction và accessibility nếu audit phát hiện |
| app/globals.css | Shared + per-tone visual system | Giữ/hoàn thiện responsive/focus/reduced-motion nếu audit phát hiện |
| tests/* | Catalog integrity tests | Mở rộng test nếu thiếu contract trọng yếu |
| .github/workflows/ci.yml | CI quality gate | Bổ sung typecheck |
| README.md | Chưa xác minh tồn tại | Bổ sung run/test/deploy documentation nếu thiếu |

### Dependencies bị ảnh hưởng
| File | Quan hệ với file cần sửa |
|---|---|
| data/products.json | Nguồn nội dung cho hub và tất cả demo routes |
| app/work/[slug]/page.tsx | Static params phụ thuộc toàn bộ slug catalog |
| next.config.ts | Quyết định static export/build behavior |

### Bảng/Entity DB liên quan
| Bảng | Cột liên quan | Ràng buộc (FK/Index) cần chú ý |
|---|---|---|
| Không có | Không có | Phase 5 xác nhận portfolio MVP không dùng persistent DB |

### Test hiện có bao phủ vùng này
| File test | Kịch bản đang test |
|---|---|
| tests/catalog.test.mjs | Catalog integrity hiện hữu; sẽ đọc và bổ sung nếu thiếu |
| Playwright MCP | Browser smoke desktop/mobile sẽ chạy sau build |

### Ảnh hưởng
Giữ single-app static-export architecture hiện có. Tám sản phẩm là tám differentiated route experiences trong một portfolio deployable artifact; tránh duplicate dependencies và vẫn bảo toàn visual identity từng sản phẩm. Chỉ sửa các quality gap tìm thấy bằng lint/typecheck/test/build/browser verification.


## Product interaction completion — cập nhật 2026-09-26
Files: components/ProductExperience.tsx, app/globals.css
Bảng DB: Không có
Ảnh hưởng: Bổ sung interaction demo theo backlog cho cả 8 sản phẩm: campaign/revenue lens, workflow simulator, property filter, cafe cart + booking state, ecommerce variant + cart, studio project filter, treasury watchlist/trade simulation. Mọi trạng thái chỉ chạy local; không gửi payment/trade/PII ra ngoài.
Verification: pnpm lint pass; pnpm typecheck pass; 4/4 node tests pass; next build static export pass; Playwright browser smoke xác nhận state thay đổi và không có current-page console error.

