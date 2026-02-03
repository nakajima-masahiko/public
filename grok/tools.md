### 1. Code Execution
- **説明**: これはステートフルなコードインタープリタで、コードを実行して出力を確認できます。REPL環境なので、前の実行結果が保持されます。アタッチメントのファイルにアクセス可能で、ファイル名を直接コードで参照します（例: open('test.txt', 'r')）。デフォルトのPython 3.12.3環境で、基本ライブラリやSTEM関連ライブラリ（numpy, sympy, rdkitなど）が利用可能。インターネットアクセスはpolygonとcoingeckoのみで、追加パッケージのインストールは不可。
- **アクション**: code_execution
- **引数**:
  - code: 実行するコード（文字列、必須）

### 2. Browse Page
- **説明**: 指定したウェブサイトのURLからコンテンツを取得します。LLMサマライザーを使用して、提供された指示に基づいて抽出/要約します。
- **アクション**: browse_page
- **引数**:
  - url: 閲覧するウェブページのURL（文字列、必須）
  - instructions: サマライザーへの指示。明確で自己完結したものにし、広範な概要や特定の詳細を指定（文字列、必須）

### 3. Web Search
- **説明**: ウェブを検索します。site:reddit.comなどの検索演算子を使用可能。
- **アクション**: web_search
- **引数**:
  - query: 検索クエリ（文字列、必須）
  - num_results: 結果数（整数、オプション、デフォルト10、最大30）

### 4. X Keyword Search
- **説明**: Xの投稿を高度に検索するツール。
- **アクション**: x_keyword_search
- **引数**:
  - query: Xの高度検索クエリ文字列。すべての高度演算子をサポート（例: (puppy OR kitten) filter:images）（文字列、必須）
  - limit: 返却する投稿数（整数、オプション、デフォルト3）
  - mode: ソートモード（TopまたはLatest、文字列、オプション、デフォルトTop）

### 5. X Semantic Search
- **説明**: 意味検索クエリに関連するXの投稿を取得。
- **アクション**: x_semantic_search
- **引数**:
  - query: 意味検索クエリ（文字列、必須）
  - limit: 返却する投稿数（整数、オプション、デフォルト3）
  - from_date: 開始日（YYYY-MM-DD、文字列またはnull、オプション、デフォルトNone）
  - to_date: 終了日（YYYY-MM-DD、文字列またはnull、オプション、デフォルトNone）
  - exclude_usernames: 除外ユーザー名（配列またはnull、オプション、デフォルトNone）
  - usernames: 含むユーザー名（配列またはnull、オプション、デフォルトNone）
  - min_score_threshold: 最小関連スコア（数値、オプション、デフォルト0.18）

### 6. X User Search
- **説明**: 検索クエリに基づいてXユーザーを検索。
- **アクション**: x_user_search
- **引数**:
  - query: 検索する名前またはアカウント（文字列、必須）
  - count: 返却するユーザー数（整数、オプション、デフォルト3）

### 7. X Thread Fetch
- **説明**: X投稿とそのコンテキスト（親やリプライ）を取得。
- **アクション**: x_thread_fetch
- **引数**:
  - post_id: 投稿ID（整数、必須）

### 8. View Image
- **説明**: 指定したURLまたはIDの画像を表示。
- **アクション**: view_image
- **引数**:
  - image_url: 画像URL（文字列またはnull、オプション、デフォルトNone）
  - image_id: 画像ID（整数またはnull、オプション、デフォルトNone）

### 9. View X Video
- **説明**: X上のビデオのフレームと字幕を表示。URLはXホストのビデオに直接リンク。
- **アクション**: view_x_video
- **引数**:
  - video_url: ビデオURL（文字列、必須）

### 10. Search Pdf Attachment
- **説明**: PDFファイルで検索クエリに関連するページを検索。ページ番号とテキストスニペットを返却。
- **アクション**: search_pdf_attachment
- **引数**:
  - file_name: PDFファイル名（文字列、必須）
  - query: 検索クエリ（文字列、必須）
  - mode: 検索モード（keywordまたはregex、文字列、必須）

### 11. Browse Pdf Attachment
- **説明**: PDFファイルを閲覧。指定ページのテキストとスクリーンショットを返却。
- **アクション**: browse_pdf_attachment
- **引数**:
  - file_name: PDFファイル名（文字列、必須）
  - pages: ページ番号（カンマ区切り、1-indexed、例: '1,3,5-7'）（文字列、必須）

### 12. Search Images
- **説明**: 説明に基づいて画像を検索。視覚的な文脈を追加する場合に使用。
- **アクション**: search_images
- **引数**:
  - image_description: 画像の説明（文字列、必須）
  - number_of_images: 画像数（整数、オプション、デフォルト3）

### 13. Conversation Search
- **説明**: 意味検索クエリに関連する過去の会話を取得。
- **アクション**: conversation_search
- **引数**:
  - query: 意味検索クエリ（文字列、必須）
