declare global {
    namespace NodeJS {
        interface ProcessEnv {
            NOTION_API_KEY      : string;
            NOTION_DB_ID        : string;
            NOTION_TEST_DB_ID   : string;
            ACCUWEATHER_API_KEY : string;
            ACCUWEATHER_CITY_ID : string;
            FORCE_NEW_KEY       : string;
        }
    }
}

export { };